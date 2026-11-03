using System;
using System.Collections.Generic;
using System.Linq;

namespace Domino.Domain
{
    public readonly struct Tile : IEquatable<Tile>
    {
        public int A { get; }
        public int B { get; }
        public int Pips => A + B;
        public bool Double => A == B;
        public Tile(int a, int b) { if (a < 0 || b < 0 || a > 6 || b > 6) throw new ArgumentOutOfRangeException(); A = Math.Min(a,b); B = Math.Max(a,b); }
        public bool Has(int n) => A == n || B == n;
        public int Other(int n) => A == n ? B : B == n ? A : throw new InvalidOperationException("Punta incompatible");
        public bool Equals(Tile t) => A == t.A && B == t.B;
        public override bool Equals(object? o) => o is Tile t && Equals(t);
        public override int GetHashCode() => A * 7 + B;
        public override string ToString() => A + "–" + B;
        public static Tile[] Deck() => Enumerable.Range(0,7).SelectMany(a => Enumerable.Range(a,7-a).Select(b => new Tile(a,b))).ToArray();
    }
    public enum End { Left, Right }
    // Explicit house variants. Defaults reproduce patio-rd/1 exactly.
    public enum Counting { AllHands, OpponentsOnly }
    public enum BlockRule { BlockerVersusNext, TeamTotals }
    public enum BlockTie { Blocker, NoPoints }
    public enum NextOpening { HandWinner, RotateRight, DoubleSix }
    public sealed class RuleSet
    {
        public string Version => IsDefaultVariant ? "patio-rd/1" : "patio-rd/1+casa";
        public int Target { get; }
        public int Bonus { get; }
        public int TurnSeconds { get; }
        public Counting Counting { get; }
        public BlockRule Block { get; }
        public BlockTie Tie { get; }
        public NextOpening Next { get; }
        public bool CapicuaBonus { get; }
        public bool PasoCorridoBonus { get; }
        public bool PaseSalidaBonus { get; }
        public bool IsDefaultVariant => Counting==Counting.AllHands && Block==BlockRule.BlockerVersusNext && Tie==BlockTie.Blocker && Next==NextOpening.HandWinner && CapicuaBonus && PasoCorridoBonus && PaseSalidaBonus;
        public RuleSet(int target = 200, int bonus = 25, int turnSeconds = 30, Counting counting = Counting.AllHands, BlockRule block = BlockRule.BlockerVersusNext, BlockTie tie = BlockTie.Blocker, NextOpening next = NextOpening.HandWinner, bool capicuaBonus = true, bool pasoCorridoBonus = true, bool paseSalidaBonus = true)
        {
            if(target < 1 || (bonus != 0 && bonus != 25 && bonus != 30) || turnSeconds < 5 || turnSeconds > 120) throw new ArgumentException("Reglas inválidas");
            if(!Enum.IsDefined(typeof(Counting),counting) || !Enum.IsDefined(typeof(BlockRule),block) || !Enum.IsDefined(typeof(BlockTie),tie) || !Enum.IsDefined(typeof(NextOpening),next)) throw new ArgumentException("Variante desconocida");
            Target=target; Bonus=bonus; TurnSeconds=turnSeconds; Counting=counting; Block=block; Tie=tie; Next=next; CapicuaBonus=capicuaBonus; PasoCorridoBonus=pasoCorridoBonus; PaseSalidaBonus=paseSalidaBonus;
        }
        // Null means the next hand is opened with the 6–6 by whoever holds it.
        public int? NextOpener(int previousOpener, HandResult result) =>
            Next==NextOpening.HandWinner ? result.Winner : Next==NextOpening.RotateRight ? (previousOpener+1)%4 : (int?)null;
    }
    public readonly struct Placement
    {
        public Tile Tile { get; }
        public int Left { get; }
        public int Right { get; }
        public Placement(Tile tile,int left,int right) { Tile=tile; Left=left; Right=right; }
    }
    public sealed class HandResult
    {
        public int Winner { get; }
        public int Points { get; }
        public bool Capicua { get; }
        public string Reason { get; }
        // A void block (BlockTie.NoPoints) awards nothing; Winner then only names the blocker.
        public bool Void { get; }
        public HandResult(int winner,int points,bool capicua,string reason,bool isVoid=false) { Winner=winner; Points=points; Capicua=capicua; Reason=reason; Void=isVoid; }
    }
    // A hand owns all mutations. Callers receive copies, never writable collections.
    public sealed class Game
    {
        readonly List<Tile>[] hands;
        readonly List<Placement> chain = new List<Placement>();
        readonly int[] scores;
        readonly List<string> events = new List<string>();
        int direction=1;
        int opener, lastPlayer = -1, passes;
        bool openingCandidate;
        readonly bool forceSix;
        public RuleSet Rules { get; }
        public int Turn { get; private set; }
        public int Opener => opener;
        public int Revision { get; private set; }
        public HandResult? Result { get; private set; }
        public int Left => chain[0].Left;
        public int Right => chain[chain.Count-1].Right;
        public Placement[] Chain => chain.ToArray();
        public int[] Scores => (int[])scores.Clone();
        public string[] Events => events.ToArray();
        public Tile[] Hand(int seat) { CheckSeat(seat); return hands[seat].ToArray(); }
        public int Count(int seat) { CheckSeat(seat); return hands[seat].Count; }
        public Game(RuleSet rules,IReadOnlyList<Tile> deck,int[]? score = null,int? startingSeat = null)
        {
            if(deck.Count!=28 || deck.Distinct().Count()!=28) throw new ArgumentException("Se requieren las 28 fichas únicas");
            Rules=rules; scores=score==null?new int[2]:(int[])score.Clone();
            if(scores.Length!=2 || scores.Any(s=>s<0)) throw new ArgumentException("Marcador inválido");
            hands=Enumerable.Range(0,4).Select(s=>deck.Skip(s*7).Take(7).ToList()).ToArray();
            forceSix=!startingSeat.HasValue;
            opener=startingSeat??Array.FindIndex(hands,h=>h.Contains(new Tile(6,6)));
            CheckSeat(opener); Turn=opener;
        }
        static void CheckSeat(int seat) { if(seat<0||seat>3) throw new ArgumentOutOfRangeException(nameof(seat)); }
        public bool CanPlay(int seat,Tile tile,End end)
        {
            CheckSeat(seat);
            if(Result!=null || seat!=Turn || !hands[seat].Contains(tile) || (end!=End.Left && end!=End.Right)) return false;
            if(chain.Count==0) return !forceSix || tile.Equals(new Tile(6,6));
            return tile.Has(end==End.Left?Left:Right);
        }
        public (Tile tile, End end)[] Moves(int seat) => hands[seat].SelectMany(t=>new[]{End.Left,End.Right}.Where(e=>CanPlay(seat,t,e)).Select(e=>(t,e))).ToArray();
        public void Play(int seat,Tile tile,End end)
        {
            if(!CanPlay(seat,tile,end)) throw new InvalidOperationException("Jugada inválida o fuera de turno");
            bool first=chain.Count==0;
            bool cap=Rules.CapicuaBonus && hands[seat].Count==1 && !tile.Double && !first && Left!=Right && tile.Has(Left)&&tile.Has(Right);
            if(passes==3 && lastPlayer==seat && Rules.PasoCorridoBonus) Award(seat,"Paso corrido");
            if(openingCandidate && seat==(opener+2)%4) { if(Rules.PaseSalidaBonus) Award(opener,"Pase de salida"); openingCandidate=false; }
            if(first) chain.Add(new Placement(tile,tile.A,tile.B));
            else if(end==End.Left) chain.Insert(0,new Placement(tile,tile.Other(Left),Left));
            else chain.Add(new Placement(tile,Right,tile.Other(Right)));
            hands[seat].Remove(tile); Revision++; events.Add($"Asiento {seat}: {tile}"); lastPlayer=seat; passes=0;
            if(hands[seat].Count==0) { Finish(seat,cap,"Dominó"); return; }
            Turn=(seat+direction+4)%4;
            // Automatic passes have no client command and cannot be forged.
            while(Moves(Turn).Length==0)
            {
                events.Add($"Asiento {Turn}: Paso"); passes++;
                if(first && Turn==(opener+direction+4)%4) openingCandidate=true;
                if(Turn==(opener+2)%4) openingCandidate=false;
                Turn=(Turn+direction+4)%4;
                if(passes==4) { FinishBlock(lastPlayer); return; }
            }
        }
        // Only the authority calls these after validating a Chaos command.
        public void ReverseTurns() { direction=-direction; }
        public void SwapHands(int seat,int target,int ownIndex,int otherIndex)
        {
            var own=hands[seat][ownIndex];hands[seat][ownIndex]=hands[target][otherIndex];hands[target][otherIndex]=own;
        }
        public void Redistribute(Func<int,int> random)
        {
            var pool=hands.SelectMany(h=>h).ToArray();
            for(int i=pool.Length-1;i>0;i--){int j=random(i+1);(pool[i],pool[j])=(pool[j],pool[i]);}
            int offset=0;foreach(var hand in hands){int count=hand.Count;hand.Clear();hand.AddRange(pool.Skip(offset).Take(count));offset+=count;}
        }
        void FinishBlock(int blocker)
        {
            int rival=(blocker+direction+4)%4;
            int mine, theirs, winner;
            if(Rules.Block==BlockRule.TeamTotals)
            {
                mine=Pips(blocker)+Pips((blocker+2)%4); theirs=Pips(rival)+Pips((rival+2)%4);
                // Within the winning team, the seat with fewer pips is credited; equal pips favour the blocker side order.
                winner=mine<=theirs ? blocker : (Pips(rival)<=Pips((rival+2)%4) ? rival : (rival+2)%4);
            }
            else { mine=Pips(blocker); theirs=Pips(rival); winner=mine<=theirs?blocker:rival; }
            if(mine==theirs && Rules.Tie==BlockTie.NoPoints)
            {
                Result=new HandResult(blocker,0,false,"Trancao",true); events.Add("Trancao empatado: sin puntos");
                return;
            }
            Finish(winner,false,"Trancao");
        }
        void Award(int seat,string name)
        {
            int team=seat%2;
            if(scores[team]+Rules.Bonus<Rules.Target) { scores[team]+=Rules.Bonus; events.Add(name+" +"+Rules.Bonus); }
            else events.Add(name+": bono descartado por meta");
        }
        int Pips(int seat)=>hands[seat].Sum(t=>t.Pips);
        void Finish(int winner,bool cap,string reason)
        {
            int points=Enumerable.Range(0,4).Where(s=>Rules.Counting==Counting.AllHands||s%2!=winner%2).Sum(Pips)+(cap?Rules.Bonus:0);
            scores[winner%2]+=points; Result=new HandResult(winner,points,cap,reason);
            events.Add(reason+(cap?" ¡Capicúa!":"")+" +"+points);
        }
    }
}
