using Domino.Domain;

int checks=0, capicuas=0, blocks=0, runs=0, opening=0;
void Check(bool b,string name) { checks++; if(!b)throw new Exception(name); }
void Reject(Action a,string name) { bool rejected=false;try{a();}catch(ArgumentException){rejected=true;}catch(InvalidOperationException){rejected=true;}Check(rejected,name); }
Tile[] Shuffle(int seed) { var d=Tile.Deck();var r=new Random(seed);for(int i=27;i>0;i--){int j=r.Next(i+1);(d[i],d[j])=(d[j],d[i]);}return d; }
string Fingerprint(Game g)=>string.Join(",",g.Chain.Select(p=>$"{p.Left}:{p.Right}"))+"/"+string.Join(",",g.Scores)+"/"+g.Turn;
Check(Tile.Deck().Length==28&&Tile.Deck().Distinct().Count()==28,"28 únicas");
Reject(()=>new Tile(7,0),"Valores inválidos");
Reject(()=>new RuleSet(bonus:10),"Bono ambiguo");
Reject(()=>new Game(new RuleSet(),Enumerable.Repeat(new Tile(0,0),28).ToArray()),"Reparto duplicado");
var first=new Game(new RuleSet(),Tile.Deck());
Check(Enumerable.Range(0,4).All(s=>first.Count(s)==7),"Siete por asiento");
Check(first.Moves(first.Turn).All(m=>m.tile.Equals(new Tile(6,6))),"Salida obligatoria");
var copy=first.Hand(first.Turn);copy[0]=new Tile(0,0);Check(first.Hand(first.Turn).Distinct().Count()==7,"No mutar mano desde fuera");
Reject(()=>first.Play((first.Turn+1)%4,new Tile(6,6),End.Left),"Fuera de turno");
for(int seed=0;seed<5000;seed++)
{
    var rules=new RuleSet(); var deck=Shuffle(seed);
    var g=new Game(rules,deck);var twin=new Game(rules,deck);
    int steps=0;
    while(g.Result==null)
    {
        var moves=g.Moves(g.Turn);Check(moves.Length>0,"Pasos automáticos dejan jugada o cierran");
        var move=moves[(seed+steps)%moves.Length]; int seat=g.Turn;
        int l=g.Chain.Length==0?-1:g.Left, r=g.Chain.Length==0?-1:g.Right;
        bool expectedCap=g.Count(seat)==1&&!move.tile.Double&&l>=0&&l!=r&&move.tile.Has(l)&&move.tile.Has(r);
        int before=g.Count(seat);int revision=g.Revision;
        g.Play(seat,move.tile,move.end);twin.Play(seat,move.tile,move.end);
        Check(g.Count(seat)==before-1&&g.Revision==revision+1,"Jugada retira una ficha");
        Check(Fingerprint(g)==Fingerprint(twin),"Determinismo");
        Reject(()=>g.Play(seat,move.tile,move.end),"Repetir ficha no concede jugada");
        var all=Enumerable.Range(0,4).SelectMany(g.Hand).Concat(g.Chain.Select(p=>p.Tile)).ToArray();
        Check(all.Length==28&&all.Distinct().Count()==28,"Conservación");
        var c=g.Chain;Check(c.Zip(c.Skip(1),(a,b)=>a.Right==b.Left).All(b=>b),"Cadena conectada");
        if(g.Result!=null)
        {
            Check(g.Result.Capicua==expectedCap,"Capicúa previa a colocar");
            int count=Enumerable.Range(0,4).SelectMany(g.Hand).Sum(t=>t.Pips);
            Check(g.Result.Points==count+(expectedCap?25:0),"Cuenta completa");
            if(g.Count(seat)==0)Check(g.Result.Reason=="Dominó"&&g.Result.Winner==seat,"Dominó prevalece");
            else
            {
                blocks++; Check(Enumerable.Range(0,4).All(s=>g.Hand(s).All(t=>!t.Has(g.Left)&&!t.Has(g.Right))),"Tranque real");
                int rival=(seat+1)%4;
                int winner=g.Hand(seat).Sum(t=>t.Pips)<=g.Hand(rival).Sum(t=>t.Pips)?seat:rival;
                Check(g.Result.Winner==winner,"Tranque contra derecha y empate al trancador");
            }
            if(expectedCap)capicuas++;
        }
        Check(++steps<=28,"Finaliza en 28 colocaciones máximo");
    }
    runs+=g.Events.Count(e=>e.StartsWith("Paso corrido +"));opening+=g.Events.Count(e=>e.StartsWith("Pase de salida +"));
    var next=new Game(rules,Shuffle(seed+1),g.Scores,g.Result!.Winner);Check(next.Turn==g.Result.Winner,"Cambio salidor");
    Check(next.Moves(next.Turn).Length==14,"Salidor siguiente puede elegir ficha");
}
// Same public deal with near-target scores: intermediate bonuses must be discarded whole.
for(int seed=0;seed<200;seed++)
{
    var g=new Game(new RuleSet(),Shuffle(seed),new[]{190,190});
    while(g.Result==null)
    {
        var m=g.Moves(g.Turn)[0];g.Play(g.Turn,m.tile,m.end);
        if(g.Result==null)Check(g.Scores.SequenceEqual(new[]{190,190}),"Bono intermedio no cierra ni recorta");
    }
}
Check(blocks>0&&capicuas>0&&runs>0&&opening>0,"Cobertura de escenarios especiales");
// House variants: explicit, validated and inactive unless requested.
Check(new RuleSet().IsDefaultVariant&&new RuleSet().Version=="patio-rd/1","Predeterminado intacto");
Check(new RuleSet(counting:Counting.OpponentsOnly).Version=="patio-rd/1+casa","Variante identificada");
Reject(()=>new RuleSet(counting:(Counting)7),"Rechaza variante desconocida");
Reject(()=>new RuleSet(next:(NextOpening)9),"Rechaza salida desconocida");
int teamBlocks=0,voids=0,opponentHands=0;
var variants=new[]{
    new RuleSet(counting:Counting.OpponentsOnly),
    new RuleSet(block:BlockRule.TeamTotals),
    new RuleSet(tie:BlockTie.NoPoints),
    new RuleSet(capicuaBonus:false,pasoCorridoBonus:false,paseSalidaBonus:false)};
foreach(var rules in variants)for(int seed=0;seed<1500;seed++)
{
    var g=new Game(rules,Shuffle(seed));int steps=0,seat=0;bool cap=false;
    while(g.Result==null)
    {
        var moves=g.Moves(g.Turn);var move=moves[(seed+steps++)%moves.Length];seat=g.Turn;
        int l=g.Chain.Length==0?-1:g.Left,r=g.Chain.Length==0?-1:g.Right;
        cap=g.Count(seat)==1&&!move.tile.Double&&l>=0&&l!=r&&move.tile.Has(l)&&move.tile.Has(r);
        g.Play(seat,move.tile,move.end);
    }
    int P(int s)=>g.Hand(s).Sum(t=>t.Pips);
    var res=g.Result!;int capBonus=cap&&rules.CapicuaBonus?25:0;
    if(!rules.CapicuaBonus)Check(!res.Capicua,"Capicúa desactivada");
    if(!rules.PasoCorridoBonus)Check(!g.Events.Any(e=>e.StartsWith("Paso corrido")),"Paso corrido desactivado");
    if(!rules.PaseSalidaBonus)Check(!g.Events.Any(e=>e.StartsWith("Pase de salida")),"Pase de salida desactivado");
    if(res.Void){voids++;Check(res.Points==0&&res.Reason=="Trancao","Tranque empatado sin puntos");Check(P(seat)==P((seat+1)%4),"Solo empate exacto anula");continue;}
    if(rules.Counting==Counting.OpponentsOnly)
    {opponentHands++;Check(res.Points==Enumerable.Range(0,4).Where(s=>s%2!=res.Winner%2).Sum(P)+capBonus,"Cuenta solo rivales");}
    else Check(res.Points==Enumerable.Range(0,4).Sum(P)+capBonus,"Cuenta completa en variante");
    if(rules.Block==BlockRule.TeamTotals&&res.Reason=="Trancao")
    {
        teamBlocks++;int mine=P(seat)+P((seat+2)%4),theirs=P((seat+1)%4)+P((seat+3)%4);
        Check(mine<=theirs?res.Winner%2==seat%2:res.Winner%2!=seat%2,"Tranque por equipos, empate al trancador");
    }
    if(rules.Tie==BlockTie.NoPoints&&res.Reason=="Trancao")Check(P(seat)!=P((seat+1)%4),"Tranque desigual puntúa");
}
var sample=new HandResult(3,40,false,"Dominó");
Check(new RuleSet().NextOpener(1,sample)==3,"Sale el ganador");
Check(new RuleSet(next:NextOpening.RotateRight).NextOpener(3,sample)==0,"Salida rota a la derecha");
Check(new RuleSet(next:NextOpening.DoubleSix).NextOpener(1,sample)==null,"Salida siempre con 6–6");
var rotated=new Game(new RuleSet(next:NextOpening.DoubleSix),Shuffle(9),new[]{40,10},null);
Check(rotated.Moves(rotated.Turn).All(m=>m.tile.Equals(new Tile(6,6))),"Mano posterior con 6–6 obligatorio");
Check(teamBlocks>0&&opponentHands>0,"Cobertura de variantes");
Console.WriteLine($"Variantes: tranques por equipo={teamBlocks}, tranques nulos={voids}, manos solo rivales={opponentHands}.");
Console.WriteLine($"PASS {checks:N0} comprobaciones; 5000 manos + 200 cerca de meta. Tranques={blocks}, capicúas={capicuas}, pasos corridos={runs}, pases salida={opening}.");
