namespace Domino.Application;
public sealed record PowerCommand(string Id,int Revision,string Power,int Target=-1,int A=-1,int B=-1);
public sealed record ChaosEvent(string Id,string Power,int Player,int Target,int Seed,DateTimeOffset Start,int A=-1,int B=-1);
public static class ChaosCatalog
{
    public const int PerHand=3, PerTurn=1;
    public static readonly string[] Visual={"slam","hurricane","electric","fire","ice","blackhole","dragon","wave","meteor","break"};
    public static readonly string[] Rules={"swap","look","shield","reverse","deal"};
}
