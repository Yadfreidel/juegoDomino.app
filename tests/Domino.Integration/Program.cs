using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Text.Json;

var root=Path.GetFullPath(args[0]);var data=Path.Combine(Path.GetTempPath(),"patio-test-"+Guid.NewGuid().ToString("N"));
using var http=new HttpClient{BaseAddress=new Uri("http://127.0.0.1:5187")};
Process? server=null;int checks=0;
void Check(bool b,string name){checks++;if(!b)throw new Exception(name);}
async Task Start()
{
    var psi=new ProcessStartInfo(Path.Combine(root,".tools/dotnet/dotnet.exe")){UseShellExecute=false,RedirectStandardOutput=true,RedirectStandardError=true,CreateNoWindow=true,WorkingDirectory=root};
    psi.ArgumentList.Add(Path.Combine(root,"src/Domino.Server/bin/Release/net10.0/Domino.Server.dll"));psi.Environment["ASPNETCORE_URLS"]="http://127.0.0.1:5187";psi.Environment["PATIO_DATA"]=data;
    server=Process.Start(psi)!;server.OutputDataReceived+=(_,_)=>{};server.ErrorDataReceived+=(_,_)=>{};server.BeginOutputReadLine();server.BeginErrorReadLine();
    for(int i=0;i<100;i++){try{if((await http.GetAsync("/health")).IsSuccessStatusCode)return;}catch(HttpRequestException){}await Task.Delay(100);}throw new Exception("Servidor no inició");
}
async Task<JsonElement> Post(string path,string? token=null)
{
    using var req=new HttpRequestMessage(HttpMethod.Post,path);if(token!=null)req.Headers.Authorization=new AuthenticationHeaderValue("Bearer",token);
    using var response=await http.SendAsync(req);response.EnsureSuccessStatusCode();return (await response.Content.ReadFromJsonAsync<JsonElement>()).Clone();
}
async Task<ClientWebSocket> Connect(string id,string token)
{
    var ws=new ClientWebSocket();ws.Options.SetRequestHeader("Authorization","Bearer "+token);await ws.ConnectAsync(new Uri($"ws://127.0.0.1:5187/tables/{id}/ws"),CancellationToken.None);return ws;
}
async Task<JsonElement> Read(ClientWebSocket ws,Func<JsonElement,bool>? predicate=null)
{
    using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(10));byte[] buffer=new byte[16384];
    while(true){using var stream=new MemoryStream();WebSocketReceiveResult r;do{r=await ws.ReceiveAsync(buffer,timeout.Token);if(r.MessageType==WebSocketMessageType.Close)throw new Exception("Cierre inesperado");stream.Write(buffer,0,r.Count);}while(!r.EndOfMessage);var e=JsonSerializer.Deserialize<JsonElement>(stream.ToArray());if(predicate==null||predicate(e))return e;}
}
async Task Send(ClientWebSocket ws,object cmd)=>await ws.SendAsync(JsonSerializer.SerializeToUtf8Bytes(cmd),WebSocketMessageType.Text,true,CancellationToken.None);
var sockets=new ClientWebSocket[4];
try
{
    await Start();var ticket=await Post("/tables");string id=ticket.GetProperty("table").GetString()!;var tokens=new string[4];tokens[0]=ticket.GetProperty("token").GetString()!;
    for(int i=1;i<4;i++)tokens[i]=(await Post($"/tables/{id}/join")).GetProperty("token").GetString()!;
    using(var forbidden=await http.PostAsync($"/tables/{id}/accept",null))Check(forbidden.StatusCode==HttpStatusCode.Unauthorized,"Rechaza sin asiento");
    for(int i=0;i<4;i++)await Post($"/tables/{id}/accept",tokens[i]);
    for(int i=0;i<4;i++)sockets[i]=await Connect(id,tokens[i]);
    var states=new JsonElement[4];
    for(int i=0;i<4;i++){states[i]=await Read(sockets[i]);Check(states[i].GetProperty("seat").GetInt32()==i,"Autoriza asiento propio");Check(states[i].GetProperty("hand").GetArrayLength()==7,"Mano privada siete");Check(!states[i].TryGetProperty("deck",out _)&&!states[i].TryGetProperty("hands",out _)&&!states[i].TryGetProperty("tokenHashes",out _),"No expone secretos");}
    var all=states.SelectMany(s=>s.GetProperty("hand").EnumerateArray().Select(t=>(t.GetProperty("a").GetInt32(),t.GetProperty("b").GetInt32()))).ToArray();Check(all.Distinct().Count()==28,"Cuatro vistas completan reparto único");
    int turn=states[0].GetProperty("turn").GetInt32();
    var command=new{id="integration-first",revision=0,a=6,b=6,end="left"};
    await Send(sockets[(turn+1)%4],command);await Read(sockets[(turn+1)%4],s=>s.GetProperty("error").ValueKind==JsonValueKind.String);checks++;
    await Send(sockets[turn],command);var after=await Read(sockets[turn],s=>s.GetProperty("revision").GetInt32()==1);
    await Send(sockets[turn],command);await Task.Delay(350);var duplicate=await Read(sockets[turn],s=>s.GetProperty("revision").GetInt32()==1);Check(duplicate.GetProperty("counts")[turn].GetInt32()==6,"Reenvío idempotente");
    await Send(sockets[turn],new{id="stale",revision=0,a=0,b=0,end="left"});await Read(sockets[turn],s=>s.GetProperty("error").ValueKind==JsonValueKind.String);checks++;
    var oldDeadline=after.GetProperty("deadline").GetString();
    // Abrupt disconnect, server restart and reconnection using the original seat credentials.
    foreach(var ws in sockets){ws.Abort();ws.Dispose();}server!.Kill(true);await server.WaitForExitAsync();server.Dispose();await Start();
    for(int i=0;i<4;i++)sockets[i]=await Connect(id,tokens[i]);
    var recovered=await Read(sockets[turn]);Check(recovered.GetProperty("revision").GetInt32()==1,"Recuperación por replay");Check(recovered.GetProperty("deadline").GetString()==oldDeadline,"Reconexión no reinicia turno");
    int revision=1;
    while(true)
    {
        for(int i=0;i<4;i++)states[i]=await Read(sockets[i],s=>s.GetProperty("revision").GetInt32()>=revision);
        var state=states[0];if(state.GetProperty("result").ValueKind!=JsonValueKind.Null)break;
        turn=state.GetProperty("turn").GetInt32();var chain=state.GetProperty("chain");int left=chain[0].GetProperty("left").GetInt32(),right=chain[chain.GetArrayLength()-1].GetProperty("right").GetInt32();
        var tile=states[turn].GetProperty("hand").EnumerateArray().First(t=>{int a=t.GetProperty("a").GetInt32(),b=t.GetProperty("b").GetInt32();return a==left||b==left||a==right||b==right;});
        int ta=tile.GetProperty("a").GetInt32(),tb=tile.GetProperty("b").GetInt32();
        await Task.Delay(60); // Artificial command latency.
        await Send(sockets[turn],new{id="move-"+revision,revision,a=ta,b=tb,end=ta==left||tb==left?"left":"right"});revision++;
    }
    Check(revision<=28,"Cuatro clientes completan mano real");
    Console.WriteLine($"PASS integración: {checks} comprobaciones, 4 clientes WebSocket, latencia artificial 60 ms, desconexión abrupta, reinicio, privacidad, idempotencia y mano completa ({revision} jugadas). Datos temporales: {data}");
}
finally{foreach(var ws in sockets)if(ws!=null){ws.Abort();ws.Dispose();}if(server!=null&&!server.HasExited){server.Kill(true);await server.WaitForExitAsync();}server?.Dispose();}
