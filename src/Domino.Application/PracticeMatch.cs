using Domino.Domain;

namespace Domino.Application;

// Graphical local adapter: one human and three bots, sharing the production rule engine.
public sealed class PracticeMatch
{
    readonly IShuffleProvider shuffle;
    readonly IClock clock;
    readonly int[] wins = new int[2];
    Game? game;
    PracticeSettings settings=new();
    DateTimeOffset? deadline;
    bool configured;
    readonly string sessionId=Guid.NewGuid().ToString("N");
    DateTimeOffset nextBot;
    bool accepted;
    int handNumber = 1;
    int version;
    readonly Func<int,int> random;
    // Seat 0 is always the human; seat 2 is the partner. Names are presentation, not authority.
    static readonly string[] Characters={"carlos","luis","ana"};
    string[] seating={"tu","carlos","ana","luis"};
    public object Sync { get; } = new();

    public PracticeMatch(IShuffleProvider shuffle, IClock clock, Func<int,int>? random=null)
    {
        this.shuffle=shuffle; this.clock=clock; this.random=random??System.Security.Cryptography.RandomNumberGenerator.GetInt32;
        nextBot=clock.UtcNow.AddSeconds(1);
    }
    static string[] Seating(string partner)
    {
        var others=Characters.Where(c=>c!=partner).ToArray();
        return new[]{"tu",others[0],partner,others[1]};
    }
    public string? Configure(PracticeSettings value)
    {
        if(accepted)return "Ya hay una práctica activa. Vuelve a ella o termínala antes de crear otra.";
        var error=value.Validate();if(error!=null)return error;
        settings=value;seating=Seating(value.Partner=="random"?Characters[random(3)]:value.Partner);
        configured=true;game=null;version++;return null;
    }
    RuleSet Rules()=>settings.ToRules();
    void ResetDeadline()=>deadline=settings.TurnSeconds==0?null:clock.UtcNow.AddSeconds(settings.TurnSeconds);
    public void Start()
    {
        if(accepted)return;
        configured=true;accepted=true;game=new Game(Rules(),shuffle.Shuffle());version++;ResetDeadline();nextBot=clock.UtcNow.AddSeconds(1.1);
    }
    public void Leave()
    {
        accepted=false;configured=false;game=null;deadline=null;wins[0]=wins[1]=0;handNumber=1;version++;
    }
    public string? Play(int revision,int a,int b,string end)
    {
        if(!accepted||game==null)return "Acepta las reglas para comenzar.";
        Tick(); // Resolve an expired turn before accepting a late client command.
        if(revision!=version)return "La mesa cambió. Selecciona la ficha otra vez.";
        if(end!="left"&&end!="right")return "Elige una punta válida.";
        try
        {
            var t=new Tile(a,b);var e=end=="left"?End.Left:End.Right;
            if(!game.CanPlay(0,t,e))return "Esa jugada no está disponible.";
            Commit(t,e);return null;
        }
        catch(ArgumentException){return "Ficha inválida.";}
    }
    void Commit(Tile tile,End end)
    {
        game!.Play(game.Turn,tile,end);version++;ResetDeadline();
        nextBot=clock.UtcNow.AddSeconds(1.35);
        if(game.Result is {Void:false})wins[game.Result.Winner%2]++;
    }
    public void Tick()
    {
        if(!accepted||game==null||game.Result!=null)return;
        if(deadline.HasValue&&clock.UtcNow>=deadline.Value)
        {
            var automatic=game.Moves(game.Turn).OrderBy(m=>m.tile.A).ThenBy(m=>m.tile.B).ThenBy(m=>m.end).First();
            Commit(automatic.tile,automatic.end);return;
        }
        if(game.Turn==0||clock.UtcNow<nextBot)return;
        // This view contains only the active bot's own playable tiles and public ends.
        var moves=game.Moves(game.Turn);
        var m=settings.Difficulty=="easy"?moves.OrderBy(m=>m.tile.A).ThenBy(m=>m.tile.B).ThenBy(m=>m.end).First():
            settings.Difficulty=="hard"?moves.OrderByDescending(m=>BotValue(m.tile,m.end)).ThenByDescending(m=>m.tile.Pips).First():
            moves.OrderByDescending(m=>m.tile.Pips).ThenBy(m=>m.tile.A).First();
        Commit(m.tile,m.end);
    }
    int BotValue(Tile tile,End end)
    {
        var own=game!.Hand(game.Turn).Where(t=>!t.Equals(tile)).ToArray();
        int next=game.Chain.Length==0?tile.B:tile.Other(end==End.Left?game.Left:game.Right);
        return own.Count(t=>t.Has(next))*16+tile.Pips+(tile.Double?4:0);
    }
    public string? Next()
    {
        if(game?.Result==null)return "La mano sigue en juego.";
        bool finished=game.Scores.Any(s=>s>=game.Rules.Target);
        int[]? score=finished?null:game.Scores;int? opener=finished?null:game.Rules.NextOpener(game.Opener,game.Result);
        if(finished){wins[0]=wins[1]=0;handNumber=1;}else handNumber++;
        game=new Game(Rules(),shuffle.Shuffle(),score,opener);version++;ResetDeadline();nextBot=clock.UtcNow.AddSeconds(1.1);
        return null;
    }
    public object Snapshot(string? error=null)=>new
    {
        revision=version,sessionId,configured,accepted,settings,handNumber,rulesVersion=Rules().Version,
        seats=seating.Select((name,seat)=>new{name,bot=seat!=0,team=seat%2==0?"us":"them"}).ToArray(),turn=game?.Turn??0,error,
        deadline=game?.Result==null?deadline:null,serverNow=clock.UtcNow,
        hand=(game?.Hand(0)??Array.Empty<Tile>()).Select(t=>new{a=t.A,b=t.B}).ToArray(),
        counts=Enumerable.Range(0,4).Select(s=>game?.Count(s)??7).ToArray(),
        chain=(game?.Chain??Array.Empty<Placement>()).Select(p=>new{left=p.Left,right=p.Right}).ToArray(),
        moves=game==null?Array.Empty<object>():game.Moves(0).Select(m=>(object)new{a=m.tile.A,b=m.tile.B,end=m.end==End.Left?"left":"right"}).ToArray(),
        scores=game?.Scores??new int[2],wins=(int[])wins.Clone(),events=game?.Events.TakeLast(8).ToArray()??Array.Empty<string>(),
        result=game?.Result==null?null:new
        {
            winner=game.Result.Winner,points=game.Result.Points,reason=game.Result.Reason,isVoid=game.Result.Void,
            capicua=game.Result.Capicua,remaining=Enumerable.Range(0,4).Select(s=>game.Hand(s).Sum(t=>t.Pips)).ToArray(),
            finished=game.Scores.Any(s=>s>=game.Rules.Target)
        }
    };
}
