using Domino.Domain;
using Domino.Infrastructure;
var rules=new RuleSet();int[]? scores=null;int? opener=null;
Console.WriteLine("DOMINÓ PATIO RD · Humano asiento 0, frente 2. Meta 200. Bonos 25.\nTranque contra derecha, empate al trancador. Cuenta todas las pintas.\nPasos automáticos. Sin reloj local. Aceptar reglas: escribe SI");
if(Console.ReadLine()?.ToUpperInvariant()!="SI")return;
while(true)
{
    var g=new Game(rules,new SecureShuffle().Shuffle(),scores,opener);int events=0;
    while(g.Result==null)
    {
        Console.WriteLine("\nMesa: "+string.Join(" ",g.Chain.Select(p=>$"[{p.Left}|{p.Right}]")));
        var moves=g.Moves(g.Turn);
        if(g.Turn==0)
        {
            Console.WriteLine("Tu mano: "+string.Join(" ",g.Hand(0)));for(int i=0;i<moves.Length;i++)Console.WriteLine($"{i}: {moves[i].tile} {moves[i].end}");
            Console.Write("Jugada (q sale): ");string? input=Console.ReadLine();if(input==null||input=="q")return;
            if(!int.TryParse(input,out int index)||index<0||index>=moves.Length)continue;
            Console.Write("Confirmar SI: ");if(Console.ReadLine()?.ToUpperInvariant()!="SI")continue;
            g.Play(0,moves[index].tile,moves[index].end);
        }
        else{var m=moves.OrderByDescending(m=>m.tile.Pips).First();g.Play(g.Turn,m.tile,m.end);}
        foreach(var e in g.Events.Skip(events))Console.WriteLine(e);events=g.Events.Length;
    }
    scores=g.Scores;opener=g.Result.Winner;Console.WriteLine($"Marcador {scores[0]}–{scores[1]}");
    if(scores.Any(s=>s>=200)){Console.WriteLine("Partida cerrada.");return;}
    Console.Write("Enter siguiente mano; q termina: ");if(Console.ReadLine()=="q")return;
}
