using System.Text.Json;
using Domino.Application;
using Domino.Domain;

int checks=0;
void Check(bool ok,string message){checks++;if(!ok)throw new Exception(message);}
JsonElement View(PracticeMatch m)=>JsonSerializer.SerializeToElement(m.Snapshot(),new JsonSerializerOptions(JsonSerializerDefaults.Web));
var clock=new FakeClock();var shuffle=new FixedShuffle();var match=new PracticeMatch(shuffle,clock);
Check(View(match).GetProperty("hand").GetArrayLength()==0&&shuffle.Calls==0,"No reparte antes de aceptar");
Check(match.Configure(new PracticeSettings{Target=125})!=null,"Rechaza meta inválida");
Check(match.Configure(new PracticeSettings{Environment="club"})!=null,"Rechaza escenario inexistente");
Check(match.Configure(new PracticeSettings{TurnSeconds=10})!=null,"Rechaza reloj inválido");
Check(match.Configure(new PracticeSettings{Difficulty="cheat"})!=null,"Rechaza bot desconocido");
Check(match.Configure(new PracticeSettings{Target=100,TurnSeconds=15,Difficulty="hard",Bonus=0})==null,"Configura práctica");
Check(shuffle.Calls==0,"Sala de espera no reparte");
match.Start();var first=View(match);var deadline=first.GetProperty("deadline").GetString();
match.Start();Check(shuffle.Calls==1&&View(match).GetProperty("deadline").GetString()==deadline,"Ready repetido idempotente");
Check(match.Configure(new PracticeSettings())!=null,"No cambia reglas activas");
Check(match.Next()!=null,"No salta mano activa");
int initial=View(match).GetProperty("revision").GetInt32();clock.Advance(16);match.Tick();
Check(View(match).GetProperty("revision").GetInt32()==initial+1,"Timeout coloca exactamente una ficha");
Check(View(match).GetProperty("chain").GetArrayLength()==1,"Apertura automática legal");
Check(match.Play(initial,6,6,"left")!=null,"Rechaza revisión atrasada");
for(int i=0;i<300;i++)
{
    var s=View(match);
    Check(!s.TryGetProperty("hands",out _)&&!s.TryGetProperty("deck",out _),"Snapshot no expone manos rivales");
    if(s.GetProperty("result").ValueKind!=JsonValueKind.Null)break;
    clock.Advance(16);match.Tick();
}
var final=View(match);Check(final.GetProperty("result").ValueKind!=JsonValueKind.Null,"Reloj completa mano real");
Check(final.GetProperty("settings").GetProperty("target").GetInt32()==100,"Conserva meta elegida");
Check(match.Next()==null,"Continúa mano/revancha con mismas reglas");
match.Leave();Check(!View(match).GetProperty("accepted").GetBoolean()&&View(match).GetProperty("hand").GetArrayLength()==0,"Distingue abandonar y cerrar panel");
var late=new PracticeMatch(new FixedShuffle(),clock);late.Configure(new PracticeSettings{TurnSeconds=15});late.Start();clock.Advance(2);late.Tick();
var lateState=View(late);Check(lateState.GetProperty("turn").GetInt32()==0,"Escenario de turno humano");
var lateMove=lateState.GetProperty("moves")[0];int lateRevision=lateState.GetProperty("revision").GetInt32();clock.Advance(16);
Check(late.Play(lateRevision,lateMove.GetProperty("a").GetInt32(),lateMove.GetProperty("b").GetInt32(),lateMove.GetProperty("end").GetString()!)!=null,"Rechaza jugada que llega tras el plazo aun sin polling");
Check(View(late).GetProperty("revision").GetInt32()==lateRevision+1,"El timeout no ejecuta dos acciones");
foreach(var difficulty in new[]{"easy","intermediate","hard"})
{
    var m=new PracticeMatch(new FixedShuffle(),clock);m.Configure(new PracticeSettings{Difficulty=difficulty,TurnSeconds=15,Target=150,Bonus=30,Environment="terrace"});m.Start();
    for(int i=0;i<35&&View(m).GetProperty("result").ValueKind==JsonValueKind.Null;i++){clock.Advance(2);m.Tick();var s=View(m);if(s.GetProperty("turn").GetInt32()==0){var move=s.GetProperty("moves")[0];Check(m.Play(s.GetProperty("revision").GetInt32(),move.GetProperty("a").GetInt32(),move.GetProperty("b").GetInt32(),move.GetProperty("end").GetString()!)==null,"Jugada humana validada");}}
    Check(View(m).GetProperty("result").ValueKind!=JsonValueKind.Null,"Bots completan mano: "+difficulty);
}
string Seats(PracticeMatch m)=>string.Join(",",View(m).GetProperty("seats").EnumerateArray().Select(s=>s.GetProperty("name").GetString()));
var teams=new PracticeMatch(new FixedShuffle(),clock,_=>1);
Check(Seats(teams)=="tu,carlos,ana,luis","Asientos predeterminados");
Check(teams.Configure(new PracticeSettings{Partner="pedro"})!=null,"Rechaza pareja inexistente");
Check(teams.Configure(new PracticeSettings{Counting="half"})!=null,"Rechaza conteo desconocido");
Check(teams.Configure(new PracticeSettings{BlockTie="rival"})!=null,"Rechaza empate desconocido");
Check(teams.Configure(new PracticeSettings{NextOpener="loser"})!=null,"Rechaza salida desconocida");
Check(teams.Configure(new PracticeSettings{Partner="carlos"})==null&&Seats(teams)=="tu,luis,carlos,ana","Anfitrión elige pareja");
Check(teams.Configure(new PracticeSettings{Partner="random"})==null&&Seats(teams)=="tu,carlos,luis,ana","Pareja aleatoria resuelta al configurar");
Check(View(teams).GetProperty("rulesVersion").GetString()=="patio-rd/1","Sin variantes conserva la versión");
Check(teams.Configure(new PracticeSettings{Counting="opponents",NextOpener="double-six",Capicua=false})==null&&View(teams).GetProperty("rulesVersion").GetString()=="patio-rd/1+casa","Variantes explícitas");
teams.Start();for(int i=0;i<300&&View(teams).GetProperty("result").ValueKind==JsonValueKind.Null;i++){clock.Advance(16);teams.Tick();var s=View(teams);if(s.GetProperty("turn").GetInt32()==0&&s.GetProperty("deadline").ValueKind==JsonValueKind.Null){var mv=s.GetProperty("moves")[0];teams.Play(s.GetProperty("revision").GetInt32(),mv.GetProperty("a").GetInt32(),mv.GetProperty("b").GetInt32(),mv.GetProperty("end").GetString()!);}}
Check(View(teams).GetProperty("result").ValueKind!=JsonValueKind.Null,"Mano con variantes termina");
Check(teams.Next()==null,"Siguiente mano con variantes");
var nextHand=View(teams);
// FixedShuffle deals the 6–6 to seat 3, so that seat must open regardless of who won.
Check(nextHand.GetProperty("turn").GetInt32()==3&&nextHand.GetProperty("chain").GetArrayLength()==0,"Mano posterior exige 6–6 con esa variante");
Check(Seats(teams)=="tu,carlos,ana,luis","Las parejas se mantienen entre manos");
Console.WriteLine($"PASS práctica: {checks} comprobaciones de sala, configuración, reloj, bots, privacidad y ciclo de mano.");
sealed class FakeClock:IClock{public DateTimeOffset UtcNow{get;private set;}=new(2026,11,2,16,0,0,TimeSpan.Zero);public void Advance(int seconds)=>UtcNow=UtcNow.AddSeconds(seconds);}
sealed class FixedShuffle:IShuffleProvider{public int Calls{get;private set;}public Tile[] Shuffle(){Calls++;return Tile.Deck();}}
