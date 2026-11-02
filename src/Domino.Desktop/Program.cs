using System.Collections.Concurrent;
using System.Security.Cryptography;
using Domino.Application;
using Domino.Infrastructure;

var builder=WebApplication.CreateBuilder(args);
var app=builder.Build();
app.UseDefaultFiles();app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse=context=>
    {
        var extension=Path.GetExtension(context.File.Name);
        if(extension is ".js" or ".html" or ".css")context.Context.Response.Headers.CacheControl="no-cache";
    }
});
var matches=new ConcurrentDictionary<string,PracticeMatch>();
PracticeMatch Match(HttpContext ctx)
{
    string cookieName="patio-practice-v2-"+(ctx.Request.Host.Port?.ToString()??"default");
    string? id=ctx.Request.Cookies[cookieName]??ctx.Request.Cookies["patio-practice-v2"];
    if(id!=null&&matches.TryGetValue(id,out var existing))
    {
        if(!ctx.Request.Cookies.ContainsKey(cookieName))ctx.Response.Cookies.Append(cookieName,id,new CookieOptions{HttpOnly=true,SameSite=SameSiteMode.Strict,MaxAge=TimeSpan.FromDays(1)});
        return existing;
    }
    id=Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
    var match=new PracticeMatch(new SecureShuffle(),new SystemClock());matches[id]=match;
    ctx.Response.Cookies.Append(cookieName,id,new CookieOptions{HttpOnly=true,SameSite=SameSiteMode.Strict,MaxAge=TimeSpan.FromDays(1)});
    return match;
}
app.MapGet("/api/game",(HttpContext ctx)=>{var m=Match(ctx);lock(m.Sync){m.Tick();return Results.Ok(m.Snapshot());}});
app.MapPost("/api/start",(HttpContext ctx)=>{var m=Match(ctx);lock(m.Sync){m.Start();return Results.Ok(m.Snapshot());}});
app.MapPost("/api/configure",(HttpContext ctx,PracticeSettings settings)=>{var m=Match(ctx);lock(m.Sync){var error=m.Configure(settings);return error==null?Results.Ok(m.Snapshot()):Results.BadRequest(m.Snapshot(error));}});
app.MapPost("/api/leave",(HttpContext ctx)=>{var m=Match(ctx);lock(m.Sync){m.Leave();return Results.Ok(m.Snapshot());}});
app.MapPost("/api/play",(HttpContext ctx,Move command)=>{var m=Match(ctx);lock(m.Sync){var error=m.Play(command.Revision,command.A,command.B,command.End);return error==null?Results.Ok(m.Snapshot()):Results.BadRequest(m.Snapshot(error));}});
app.MapPost("/api/next",(HttpContext ctx)=>{var m=Match(ctx);lock(m.Sync){var error=m.Next();return error==null?Results.Ok(m.Snapshot()):Results.BadRequest(m.Snapshot(error));}});
app.Run();
record Move(int Revision,int A,int B,string End);
