using System.Security.Cryptography;
using System.Text.Json;
using Domino.Application;
using Domino.Domain;
namespace Domino.Infrastructure;
public sealed class SystemClock : IClock {public DateTimeOffset UtcNow=>DateTimeOffset.UtcNow;}
public sealed class SecureShuffle : IShuffleProvider
{
    public Tile[] Shuffle() {var d=Tile.Deck();for(int i=27;i>0;i--){int j=RandomNumberGenerator.GetInt32(i+1);(d[i],d[j])=(d[j],d[i]);}return d;}
}
// Local prototype store. PostgreSQL adapter is deliberately a later milestone.
public sealed class FileMatchRepository : IMatchRepository
{
    readonly string directory;
    public FileMatchRepository(string directory){this.directory=directory;Directory.CreateDirectory(directory);}
    public async Task Save(TableData data)
    {
        var path=Path.Combine(directory,data.Id+".json");var temp=path+".tmp";
        await using(var stream=new FileStream(temp,FileMode.Create,FileAccess.Write,FileShare.None,4096,FileOptions.WriteThrough))
        {await JsonSerializer.SerializeAsync(stream,data);await stream.FlushAsync();stream.Flush(true);}
        File.Move(temp,path,true);
    }
    public IEnumerable<TableData> Load()=>Directory.EnumerateFiles(directory,"*.json").Select(f=>JsonSerializer.Deserialize<TableData>(File.ReadAllText(f))!);
}
