using Domino.Domain;
namespace Domino.Application;
public sealed partial class PracticeMatch
{
    readonly int[] powerUses=new int[4];
    int powerTurnUses,revealOwner;
    readonly bool[] shields=new bool[4];
    readonly Dictionary<string,PowerCommand> powerCommands=new();
    ChaosEvent? powerEvent;
    object? reveal;
    DateTimeOffset revealUntil,visualUntil;
    void ResetChaos(){Array.Clear(powerUses);powerTurnUses=0;Array.Clear(shields);powerCommands.Clear();powerEvent=null;reveal=null;visualUntil=default;}
    object ChaosSnapshot()=>new{remaining=ChaosCatalog.PerHand-powerUses[0],turnRemaining=ChaosCatalog.PerTurn-powerTurnUses,shields=(bool[])shields.Clone(),powerEvent,reveal=revealOwner==0&&clock.UtcNow<revealUntil?reveal:null,busyUntil=visualUntil};
    public string? Power(PowerCommand c,int seat=0)
    {
        if(string.IsNullOrWhiteSpace(c.Id)||c.Id.Length>64)return "Identificador inválido.";
        if(powerCommands.TryGetValue(c.Id,out var prior))return prior==c?null:"Identificador reutilizado.";
        if(seat==0)Tick();
        if(settings.Mode!="chaos"||!accepted||game==null||game.Result!=null)return "Los poderes requieren una mano activa de Dominó Caos.";
        if(c.Revision!=version||game.Turn!=seat)return "Espera tu turno y actualiza la mesa.";
        if(clock.UtcNow<visualUntil)return "Espera a que termine el efecto.";
        if(powerUses[seat]>=ChaosCatalog.PerHand||powerTurnUses>=ChaosCatalog.PerTurn)return "No quedan usos en esta mano o turno.";
        bool rules=ChaosCatalog.Rules.Contains(c.Power);
        if(!rules&&!ChaosCatalog.Visual.Contains(c.Power))return "Poder desconocido.";
        if(rules&&settings.ChaosVariant!="rules")return "Esta mesa solo permite efectos visuales.";
        if(!rules&&game.Chain.Length==0)return "Coloca primero una ficha en la mesa.";
        if(c.Power=="swap"||c.Power=="look")
        {
            if((c.Target<0||c.Target>3||c.Target%2==seat%2)||game.Count(c.Target)==0||game.Count(seat)==0)return "Elige un rival con fichas.";
        }
        if(c.Power=="electric"&&!game.Chain.Any(t=>t.Tile.Double))return "Hace falta un doble colocado.";
        if(c.Power=="fire"||c.Power=="meteor")
        {
            if(!game.Chain.Any(t=>t.Tile.A==c.A&&t.Tile.B==c.B))return "Selecciona una ficha de la cadena.";
        }
        if(c.Power=="shield"&&shields[seat])return "Tu escudo ya está activo.";
        // Keep the forced double-six opening intact and avoid changing the current playable turn into a deadlock.
        if((c.Power=="swap"||c.Power=="deal")&&game.Chain.Length==0)return "Espera a que se coloque el doble seis.";
        var saved=Enumerable.Range(0,4).Select(game.Hand).ToArray();
        bool blocked=(c.Power=="swap"||c.Power=="look")&&shields[c.Target];
        if(blocked)shields[c.Target]=false;
        else switch(c.Power)
        {
            case "swap":game.SwapHands(seat,c.Target,random(game.Count(seat)),random(game.Count(c.Target)));break;
            case "deal":game.Redistribute(random);break;
            case "look":var t=game.Hand(c.Target)[random(game.Count(c.Target))];revealOwner=seat;reveal=new{a=t.A,b=t.B,target=c.Target};revealUntil=clock.UtcNow.AddSeconds(3);break;
            case "shield":shields[seat]=true;break;
            case "reverse":game.ReverseTurns();break;
        }
        if((c.Power=="swap"||c.Power=="deal")&&game.Moves(seat).Length==0)
        {
            // Restore by swapping each unique tile back to its original owner.
            for(int ownerSeat=0;ownerSeat<4;ownerSeat++)foreach(var tile in saved[ownerSeat]){int owner=Enumerable.Range(0,4).First(s=>game.Hand(s).Contains(tile));if(owner!=ownerSeat){int index=Array.IndexOf(game.Hand(owner),tile);int wrong=Array.FindIndex(game.Hand(ownerSeat),t=>!saved[ownerSeat].Contains(t));game.SwapHands(ownerSeat,owner,wrong,index);}}
            return "El sorteo dejaría el turno sin jugada; poder cancelado sin gastar.";
        }
        powerUses[seat]++;powerTurnUses++;version++;powerCommands[c.Id]=c;
        powerEvent=new(c.Id,c.Power,seat,c.Target,random(int.MaxValue),clock.UtcNow,c.A,c.B);
        if(!rules)visualUntil=clock.UtcNow.AddSeconds(c.Power=="break"?3.6:2.4);
        return null;
    }
}
