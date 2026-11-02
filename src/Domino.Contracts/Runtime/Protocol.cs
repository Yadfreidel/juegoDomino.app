namespace Domino.Contracts
{
    public sealed class PlayCommand
    {
        public string Id { get; set; } = "";
        public int Revision { get; set; }
        public int A { get; set; }
        public int B { get; set; }
        public string End { get; set; } = "";
    }
    public sealed class SeatTicket
    {
        public string Table { get; set; } = "";
        public int Seat { get; set; }
        public string Token { get; set; } = "";
    }
}
