using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Domino.Application;
using Domino.Contracts;
using Domino.Infrastructure;
using Microsoft.AspNetCore.RateLimiting;

var builder=WebApplication.CreateBuilder(args);
builder.Services.AddRateLimiter(o=>{o.GlobalLimiter=PartitionedRateLimiter.Create<HttpContext,string>(c=>RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString()??"local",_=>new FixedWindowRateLimiterOptions{PermitLimit=120,Window=TimeSpan.FromMinutes(1)}));o.RejectionStatusCode=429;});
var app=builder.Build();app.UseRateLimiter();app.UseWebSockets();
var store=new FileMatchRepository(Environment.GetEnvironmentVariable("PATIO_DATA")??"data");
var clock=new SystemClock();var shuffle=new SecureShuffle();
var tables=new ConcurrentDictionary<string,Table>(store.Load().ToDictionary(d=>d.Id,d=>new Table(d,clock,store,shuffle)));
var json=new JsonSerializerOptions(JsonSerializerDefaults.Web);
string Hash(string token)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
string Token()=>Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
int Seat(HttpContext context,Table table)
{
    string auth=context.Request.Headers.Authorization.ToString();
    if(!auth.StartsWith("Bearer ",StringComparison.Ordinal))return -1;
    string h=Hash(auth[7..]);return Array.FindIndex(table.Data.TokenHashes,t=>t==h);
}
app.MapGet("/health",()=>Results.Ok(new{status="ok",milestone="2-prototype"}));
app.MapPost("/tables",async()=>
{
    string id=Guid.NewGuid().ToString("N");string token=Token();var data=new TableData{Id=id};data.TokenHashes[0]=Hash(token);
    await store.Save(data);tables[id]=new Table(data,clock,store,shuffle);return Results.Ok(new SeatTicket{Table=id,Seat=0,Token=token});
});
app.MapPost("/tables/{id}/join",async(string id)=>
{
    if(!tables.TryGetValue(id,out var table))return Results.NotFound();
    await table.Gate.WaitAsync();try
    {
        int seat=Array.FindIndex(table.Data.TokenHashes,string.IsNullOrEmpty);if(seat<0)return Results.Conflict();
        string token=Token();table.Data.TokenHashes[seat]=Hash(token);await store.Save(table.Data);return Results.Ok(new SeatTicket{Table=id,Seat=seat,Token=token});
    }finally{table.Gate.Release();}
});
app.MapPost("/tables/{id}/accept",async(string id,HttpContext ctx)=>
{
    if(!tables.TryGetValue(id,out var table))return Results.NotFound();
    await table.Gate.WaitAsync();try{int seat=Seat(ctx,table);if(seat<0)return Results.Unauthorized();await table.Accept(seat);return Results.Ok(table.Snapshot(seat));}finally{table.Gate.Release();}
});
app.Map("/tables/{id}/ws",async(HttpContext ctx,string id)=>
{
    if(!tables.TryGetValue(id,out var table)){ctx.Response.StatusCode=404;return;}
    int seat=Seat(ctx,table);if(seat<0){ctx.Response.StatusCode=401;return;}
    if(!ctx.WebSockets.IsWebSocketRequest){ctx.Response.StatusCode=400;return;}
    using var ws=await ctx.WebSockets.AcceptWebSocketAsync();using var stop=CancellationTokenSource.CreateLinkedTokenSource(ctx.RequestAborted);
    var sendGate=new SemaphoreSlim(1,1);string? pendingError=null;
    async Task Send()
    {
        await table.Gate.WaitAsync(stop.Token);byte[] bytes;
        try{await table.Tick();bytes=JsonSerializer.SerializeToUtf8Bytes(table.Snapshot(seat,pendingError),json);pendingError=null;}finally{table.Gate.Release();}
        await sendGate.WaitAsync(stop.Token);try{await ws.SendAsync(bytes,WebSocketMessageType.Text,true,stop.Token);}finally{sendGate.Release();}
    }
    var sender=Task.Run(async()=>{while(!stop.IsCancellationRequested){await Send();await Task.Delay(250,stop.Token);}},stop.Token);
    try
    {
        var buffer=new byte[4096];DateTimeOffset window=clock.UtcNow;int messages=0;
        while(ws.State==WebSocketState.Open)
        {
            var msg=await ws.ReceiveAsync(buffer,stop.Token);
            if(msg.MessageType==WebSocketMessageType.Close)break;
            if(!msg.EndOfMessage||msg.MessageType!=WebSocketMessageType.Text){await ws.CloseAsync(WebSocketCloseStatus.MessageTooBig,"Máximo 4 KB; un mensaje",CancellationToken.None);break;}
            if(clock.UtcNow-window>TimeSpan.FromSeconds(1)){window=clock.UtcNow;messages=0;}
            if(++messages>10){await ws.CloseAsync(WebSocketCloseStatus.PolicyViolation,"Límite de frecuencia",CancellationToken.None);break;}
            await table.Gate.WaitAsync(stop.Token);try
            {
                await table.Tick();
                try{var command=JsonSerializer.Deserialize<PlayCommand>(buffer.AsSpan(0,msg.Count),json);pendingError=command==null?"Mensaje vacío":await table.Play(seat,command);}
                catch(JsonException){pendingError="JSON inválido";}
            }finally{table.Gate.Release();}
        }
    }
    catch(OperationCanceledException){}catch(WebSocketException){}
    finally{stop.Cancel();try{await sender;}catch(OperationCanceledException){}catch(WebSocketException){}sendGate.Dispose();}
});
// Time progresses even with all clients disconnected.
var ticker=Task.Run(async()=>{while(!app.Lifetime.ApplicationStopping.IsCancellationRequested){foreach(var table in tables.Values){await table.Gate.WaitAsync();try{await table.Tick();}finally{table.Gate.Release();}}await Task.Delay(500,app.Lifetime.ApplicationStopping);}});
app.Run();
