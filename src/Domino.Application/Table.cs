using Domino.Domain;
using Domino.Contracts;

namespace Domino.Application;
public interface IClock { DateTimeOffset UtcNow { get; } }
public interface IShuffleProvider { Tile[] Shuffle(); }
public interface IMatchRepository { Task Save(TableData data); }
public sealed class SavedPlay
{
    public int Seat {get;set;}
    public PlayCommand Command {get;set;}=new();
}
public sealed class TableData
{
    public string Id {get;set;}="";
    public string[] TokenHashes {get;set;}=new string[4];
    public bool[] Accepted {get;set;}=new bool[4];
    public int[][] Deck {get;set;}=Array.Empty<int[]>();
    public List<SavedPlay> Plays {get;set;}=new();
    public DateTimeOffset? Deadline {get;set;}
}
// The transport serializes every access using this table's gate.
public sealed class Table
{
    public SemaphoreSlim Gate {get;}=new(1,1);
    public TableData Data {get;}
    public Game? Game {get;private set;}
    readonly IClock clock;
    readonly IMatchRepository repository;
    readonly IShuffleProvider shuffle;
    public Table(TableData data,IClock clock,IMatchRepository repository,IShuffleProvider shuffle)
    {
        Data=data;this.clock=clock;this.repository=repository;this.shuffle=shuffle;
        if(data.Deck.Length>0)
        {
            Game=new Game(new RuleSet(),data.Deck.Select(t=>new Tile(t[0],t[1])).ToArray());
            foreach(var p in data.Plays)Game.Play(p.Seat,new Tile(p.Command.A,p.Command.B),ParseEnd(p.Command.End));
        }
    }
    public async Task Accept(int seat)
    {
        if(Game!=null)return;
        Data.Accepted[seat]=true;
        if(Data.TokenHashes.All(t=>!string.IsNullOrEmpty(t))&&Data.Accepted.All(a=>a))
        {
            var deck=shuffle.Shuffle();Data.Deck=deck.Select(t=>new[]{t.A,t.B}).ToArray();Game=new Game(new RuleSet(),deck);Data.Deadline=clock.UtcNow.AddSeconds(30);
        }
        await repository.Save(Data);
    }
    static End ParseEnd(string end)=>end=="left"?End.Left:end=="right"?End.Right:throw new ArgumentException("Punta inválida");
    public async Task<string?> Play(int seat,PlayCommand command)
    {
        if(string.IsNullOrWhiteSpace(command.Id)||command.Id.Length>64)return "Identificador inválido";
        var prior=Data.Plays.FirstOrDefault(p=>p.Command.Id==command.Id);
        if(prior!=null)return prior.Seat==seat&&prior.Command.A==command.A&&prior.Command.B==command.B&&prior.Command.End==command.End&&prior.Command.Revision==command.Revision?null:"ID reutilizado";
        if(Game==null)return "Falta aceptar reglas";
        if(command.Revision!=Game.Revision)return "Revisión atrasada";
        try
        {
            var tile=new Tile(command.A,command.B);var end=ParseEnd(command.End);
            if(!Game.CanPlay(seat,tile,end))return "Jugada inválida o fuera de turno";
            // Persist intent before publication. A replay deterministically reconstructs the result.
            Data.Plays.Add(new SavedPlay{Seat=seat,Command=command});
            var previous=Data.Deadline;Data.Deadline=clock.UtcNow.AddSeconds(30);
            try { await repository.Save(Data); } catch { Data.Plays.RemoveAt(Data.Plays.Count-1);Data.Deadline=previous;throw; }
            Game.Play(seat,tile,end);return null;
        }
        catch(ArgumentException) {return "Mensaje inválido";}
    }
    public async Task Tick()
    {
        if(Game==null||Game.Result!=null||Data.Deadline==null||clock.UtcNow<Data.Deadline)return;
        var m=Game.Moves(Game.Turn).OrderBy(x=>x.tile.A).ThenBy(x=>x.tile.B).ThenBy(x=>x.end).First();
        await Play(Game.Turn,new PlayCommand{Id="timeout-"+Game.Revision,Revision=Game.Revision,A=m.tile.A,B=m.tile.B,End=m.end==End.Left?"left":"right"});
    }
    public object Snapshot(int seat,string? error=null)=>new
    {
        type="snapshot",table=Data.Id,seat,error,revision=Game?.Revision??0,turn=Game?.Turn,
        rules=new {version="patio-rd/1",target=200,bonus=25,turnSeconds=30,timeout="menor A, luego B, luego izquierda",reconnect="El turno no se pausa. Asiento persistente; sin abandono en este prototipo."},
        accepted=Data.Accepted.ToArray(),deadline=Data.Deadline,
        hand=Game?.Hand(seat).Select(t=>new {a=t.A,b=t.B}).ToArray(),
        counts=Game==null?null:Enumerable.Range(0,4).Select(Game.Count).ToArray(),
        chain=Game?.Chain.Select(p=>new{left=p.Left,right=p.Right}).ToArray(),scores=Game?.Scores,
        result=Game?.Result==null?null:new{winner=Game.Result.Winner,points=Game.Result.Points,reason=Game.Result.Reason,capicua=Game.Result.Capicua}
    };
}
