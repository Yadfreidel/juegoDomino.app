using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using Domino.Application;
using Domino.Infrastructure;

// The browser loads the runtime and calls PracticeBridge directly; Main has nothing to start.
return;

namespace Domino.Web
{
    // Mirrors the /api endpoints of Domino.Desktop: each call returns {"status":..., "body":"<snapshot json>"}
    // so the client can treat it exactly like an HTTP response. One practice per page, kept in memory.
    [System.Runtime.Versioning.SupportedOSPlatform("browser")]
    public static partial class PracticeBridge
    {
        static readonly JsonSerializerOptions Json=new(JsonSerializerDefaults.Web);
        static readonly PracticeMatch Match=new(new SecureShuffle(),new SystemClock());
        record Move(int Revision,int A,int B,string End);

        [JSExport] public static string Game(){lock(Match.Sync){Match.Tick();return Ok(Match.Snapshot());}}
        [JSExport] public static string Start(){lock(Match.Sync){Match.Start();return Ok(Match.Snapshot());}}
        [JSExport] public static string Leave(){lock(Match.Sync){Match.Leave();return Ok(Match.Snapshot());}}
        [JSExport] public static string Next(){lock(Match.Sync){return Result(Match.Next());}}
        [JSExport] public static string Configure(string body)
        {
            var settings=Read<PracticeSettings>(body);
            lock(Match.Sync){return settings==null?Result("Configuración no válida."):Result(Match.Configure(settings));}
        }
        [JSExport] public static string Play(string body)
        {
            var move=Read<Move>(body);
            lock(Match.Sync){return move==null?Result("Jugada no válida."):Result(Match.Play(move.Revision,move.A,move.B,move.End));}
        }
        [JSExport] public static string Power(string body){var c=Read<PowerCommand>(body);lock(Match.Sync){return Result(c==null?"Poder inv?lido.":Match.Power(c));}}
        static T? Read<T>(string body) where T:class {try{return JsonSerializer.Deserialize<T>(body,Json);}catch(JsonException){return null;}}
        static string Result(string? error)=>error==null?Ok(Match.Snapshot()):Envelope(400,Match.Snapshot(error));
        static string Ok(object snapshot)=>Envelope(200,snapshot);
        static string Envelope(int status,object snapshot)=>JsonSerializer.Serialize(new{status,body=JsonSerializer.Serialize(snapshot,Json)},Json);
    }
}
