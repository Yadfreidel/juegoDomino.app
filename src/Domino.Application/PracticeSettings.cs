using Domino.Domain;

namespace Domino.Application;

// Explicitly scoped to the supported local practice mode. Online variants are not silently accepted.
// Every default reproduces patio-rd/1, so an untouched form never changes scoring.
public sealed record PracticeSettings
{
    public string Name { get; init; }="La mesa de los panas";
    public int Target { get; init; }=200;
    public int TurnSeconds { get; init; }
    public int Bonus { get; init; }=25;
    public string Difficulty { get; init; }="intermediate";
    public string Environment { get; init; }="club";
    public bool QuickMessages { get; init; }=true;
    // "ana", "carlos", "luis" or "random": which bot sits in front of the human as partner.
    public string Partner { get; init; }="ana";
    public string NextOpener { get; init; }="winner";
    public string Counting { get; init; }="all";
    public string BlockRule { get; init; }="blocker-next";
    public string BlockTie { get; init; }="blocker";
    public bool Capicua { get; init; }=true;
    public bool PasoCorrido { get; init; }=true;
    public bool PaseSalida { get; init; }=true;
    public string? Validate()
    {
        if(string.IsNullOrWhiteSpace(Name)||Name.Length>40)return "El nombre debe tener entre 1 y 40 caracteres.";
        if(Target is not (100 or 150 or 200))return "Elige una meta de 100, 150 o 200.";
        if(TurnSeconds is not (0 or 15 or 30 or 45))return "Elige sin límite, 15, 30 o 45 segundos.";
        if(Bonus is not (0 or 25 or 30))return "El bono debe ser 0, 25 o 30.";
        if(Difficulty is not ("easy" or "intermediate" or "hard"))return "Dificultad no disponible.";
        if(Environment is not ("club" or "courtyard" or "terrace"))return "Ese escenario no está disponible.";
        if(Partner is not ("ana" or "carlos" or "luis" or "random"))return "Elige una pareja válida.";
        if(NextOpener is not ("winner" or "rotate" or "double-six"))return "Salida de manos posteriores no reconocida.";
        if(Counting is not ("all" or "opponents"))return "Conteo no reconocido.";
        if(BlockRule is not ("blocker-next" or "team"))return "Regla de tranque no reconocida.";
        if(BlockTie is not ("blocker" or "void"))return "Empate de tranque no reconocido.";
        return null;
    }
    public RuleSet ToRules()=>new(Target,Bonus,TurnSeconds==0?30:TurnSeconds,
        Counting=="opponents"?Domain.Counting.OpponentsOnly:Domain.Counting.AllHands,
        BlockRule=="team"?Domain.BlockRule.TeamTotals:Domain.BlockRule.BlockerVersusNext,
        BlockTie=="void"?Domain.BlockTie.NoPoints:Domain.BlockTie.Blocker,
        NextOpener=="rotate"?NextOpening.RotateRight:NextOpener=="double-six"?NextOpening.DoubleSix:NextOpening.HandWinner,
        Capicua,PasoCorrido,PaseSalida);
}
