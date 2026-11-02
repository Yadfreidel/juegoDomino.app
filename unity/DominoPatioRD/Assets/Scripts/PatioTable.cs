using System;
using System.Linq;
using Domino.Domain;
using UnityEngine;

namespace PatioRD
{
    // Local milestone adapter. Multiplayer will replace this authority with transport snapshots.
    public sealed class PatioTable : MonoBehaviour
    {
        Game game;
        readonly RuleSet rules = new RuleSet();
        readonly System.Random random = new System.Random();
        readonly int[] wins = new int[2];
        Transform pieces;
        Material ivory, ink, wood, green, gold;
        Tile? selected;
        End? selectedEnd;
        float nextBot;
        string message = "Selecciona una ficha, elige punta y confirma.";
        bool accepted;
        bool ascending = true;
        bool sound = true;
        AudioSource audioSource;
        AudioClip knock;
        GUIStyle heading, label, button;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Bootstrap() { if (FindFirstObjectByType<PatioTable>() == null) new GameObject("Patio RD").AddComponent<PatioTable>(); }
        Material Mat(Color c) { var template=Resources.Load<Material>("PatioMaterial"); var m=template!=null?new Material(template):new Material(Shader.Find("Universal Render Pipeline/Lit")); m.color=c; return m; }
        GameObject Box(string name,Vector3 p,Vector3 scale,Material m,Transform parent=null)
        {
            var o=GameObject.CreatePrimitive(PrimitiveType.Cube); o.name=name; o.transform.SetParent(parent,false); o.transform.localPosition=p; o.transform.localScale=scale; o.GetComponent<Renderer>().sharedMaterial=m; return o;
        }
        void Awake()
        {
            Application.targetFrameRate=60; Screen.orientation=ScreenOrientation.LandscapeLeft;
            ivory=Mat(new Color(.91f,.84f,.66f)); ink=Mat(new Color(.025f,.035f,.03f)); wood=Mat(new Color(.22f,.085f,.035f)); green=Mat(new Color(.025f,.19f,.12f)); gold=Mat(new Color(.8f,.55f,.2f));
            var cam=Camera.main; if(cam==null) cam=new GameObject("Camera",typeof(Camera),typeof(AudioListener)).GetComponent<Camera>();
            cam.transform.position=new Vector3(0,6.6f,-8.2f); cam.transform.LookAt(new Vector3(0,0,1.2f)); cam.fieldOfView=53; cam.backgroundColor=new Color(.56f,.31f,.34f); cam.clearFlags=CameraClearFlags.SolidColor;
            RenderSettings.ambientLight=new Color(.65f,.48f,.36f);
            var sun=new GameObject("Atardecer",typeof(Light)).GetComponent<Light>(); sun.type=LightType.Directional; sun.color=new Color(1,.75f,.48f); sun.intensity=1.3f; sun.transform.rotation=Quaternion.Euler(40,-30,0);
            Box("Terraza",new Vector3(0,-.65f,0),new Vector3(22,.3f,19),wood);
            Box("Mar",new Vector3(0,-1,30),new Vector3(150,.1f,60),Mat(new Color(.12f,.31f,.39f)));
            Box("Mesa de madera",new Vector3(0,-.25f,0),new Vector3(12,.45f,7.6f),wood);
            Box("Paño",Vector3.zero,new Vector3(11.2f,.08f,6.8f),green);
            foreach(int side in new[]{-1,1}) Box("Borde",new Vector3(side*5.8f,.08f,0),new Vector3(.35f,.3f,7.6f),wood);
            foreach(int side in new[]{-1,1}) Box("Borde",new Vector3(0,.08f,side*3.65f),new Vector3(12,.3f,.35f),wood);
            for(int i=0;i<7;i++)
            {
                float x=(i-3)*2.8f;
                Box("Columna",new Vector3(x,2.4f,7),new Vector3(.25f,6,.25f),wood);
                var lamp=GameObject.CreatePrimitive(PrimitiveType.Sphere); lamp.name="Luz cálida"; lamp.transform.position=new Vector3(x,4.1f,6); lamp.transform.localScale=Vector3.one*.22f; lamp.GetComponent<Renderer>().sharedMaterial=gold;
                var light=lamp.AddComponent<Light>(); light.type=LightType.Point; light.color=new Color(1,.65f,.26f); light.intensity=1; light.range=4;
                var trunk=Box("Palmera provisional",new Vector3(x,1.1f,10),new Vector3(.22f,5,.22f),wood);
                for(int f=0;f<5;f++) { var leaf=Box("Hoja",new Vector3(x,3.4f,10),new Vector3(2.8f,.08f,.5f),green); leaf.transform.rotation=Quaternion.Euler(10,f*72,15); }
            }
            Avatar("Carlos",new Vector3(6.4f,.7f,0),new Color(.8f,.7f,.5f)); Avatar("Ana · tu frente",new Vector3(0,.7f,4.5f),new Color(.7f,.12f,.06f)); Avatar("Luis",new Vector3(-6.4f,.7f,0),new Color(.04f,.08f,.14f));
            pieces=new GameObject("Fichas").transform;
            audioSource=gameObject.AddComponent<AudioSource>();
            float[] samples=new float[2205]; for(int i=0;i<samples.Length;i++) samples[i]=(float)(Math.Sin(i*.62)*Math.Exp(-i/180.0)*.22);
            knock=AudioClip.Create("Golpe original sintetizado",samples.Length,1,22050,false); knock.SetData(samples,0);
            Deal(null,null);
        }
        void Avatar(string name,Vector3 pos,Color shirt)
        {
            Box(name+" cuerpo provisional",pos,new Vector3(1.1f,1.35f,.7f),Mat(shirt));
            var head=GameObject.CreatePrimitive(PrimitiveType.Sphere); head.name=name; head.transform.position=pos+Vector3.up*1.1f; head.transform.localScale=new Vector3(.65f,.8f,.65f); head.GetComponent<Renderer>().sharedMaterial=Mat(new Color(.55f,.31f,.18f));
        }
        void Deal(int[] scores,int? opener)
        {
            var deck=Tile.Deck(); for(int i=deck.Length-1;i>0;i--) { int j=random.Next(i+1); var t=deck[i]; deck[i]=deck[j]; deck[j]=t; }
            game=new Game(rules,deck,scores,opener); selected=null; selectedEnd=null; nextBot=Time.unscaledTime+1; Redraw();
        }
        void Redraw()
        {
            foreach(Transform child in pieces) Destroy(child.gameObject);
            // Fixed 7x4 slots fit all 28 tiles. Geometry is independent of logical endpoints.
            var chain=game.Chain;
            for(int i=0;i<chain.Length;i++)
            {
                int row=i/7, col=i%7; if(row%2==1) col=6-col;
                var p=new Vector3((col-3)*1.27f,.15f,1.65f-row*.85f);
                DrawTile(chain[i].Left,chain[i].Right,p,row%2==0?0:180);
            }
            for(int seat=1;seat<4;seat++) for(int i=0;i<game.Count(seat);i++)
            {
                Vector3 p=seat==2?new Vector3((i-3)*.6f,.3f,3.1f):new Vector3(seat==1?-5.2f:5.2f,.3f,(i-3)*.65f);
                Box("Ficha oculta",p,new Vector3(.42f,.5f,.22f),wood,pieces);
            }
        }
        void DrawTile(int a,int b,Vector3 p,float angle)
        {
            var root=new GameObject("Ficha "+a+"–"+b).transform; root.SetParent(pieces); root.position=p; root.rotation=Quaternion.Euler(0,angle,0);
            Box("Marfil",Vector3.zero,new Vector3(1.12f,.16f,.57f),ivory,root);
            Box("Separador",new Vector3(0,.085f,0),new Vector3(.015f,.008f,.5f),ink,root);
            Pips(a,-.28f,root); Pips(b,.28f,root);
        }
        void Pips(int n,float x,Transform parent)
        {
            for(int i=0;i<n;i++)
            {
                Vector2 q;
                if(n==1) q=Vector2.zero;
                else if(n==2) q=new Vector2(i==0?-1:1,i==0?-1:1);
                else if(n==3) q=new Vector2(i-1,i-1);
                else if(n==4) q=new Vector2(i%2==0?-1:1,i<2?-1:1);
                else if(n==5) q=i==4?Vector2.zero:new Vector2(i%2==0?-1:1,i<2?-1:1);
                else q=new Vector2(i%2==0?-1:1,i/2-1);
                var dot=GameObject.CreatePrimitive(PrimitiveType.Sphere); dot.name="Pinta"; dot.transform.SetParent(parent,false); dot.transform.localPosition=new Vector3(x+q.x*.13f,.084f,q.y*.16f); dot.transform.localScale=new Vector3(.075f,.015f,.075f); dot.GetComponent<Renderer>().sharedMaterial=ink;
            }
        }
        void Commit(Tile t,End end)
        {
            game.Play(game.Turn,t,end); selected=null; selectedEnd=null; message=game.Events.LastOrDefault()??""; if(sound)audioSource.PlayOneShot(knock); Redraw(); nextBot=Time.unscaledTime+1;
            if(game.Result!=null) wins[game.Result.Winner%2]++;
        }
        void Update()
        {
            if(!accepted || game.Result!=null || game.Turn==0 || Time.unscaledTime<nextBot)return;
            // Bot only consumes its own hand through the list of legal moves; no opponent hand access.
            var move=game.Moves(game.Turn).OrderByDescending(m=>m.tile.Pips).ThenBy(m=>m.tile.A).First(); Commit(move.tile,move.end);
        }
        bool Button(Rect rect,string text)=>GUI.Button(rect,text,button);
        void OnGUI()
        {
            GUI.matrix=Matrix4x4.Scale(new Vector3(Screen.width/1280f,Screen.height/720f,1));
            if(heading==null) { heading=new GUIStyle(GUI.skin.label){fontSize=30,fontStyle=FontStyle.Bold}; label=new GUIStyle(GUI.skin.label){fontSize=19,wordWrap=true}; button=new GUIStyle(GUI.skin.button){fontSize=19,wordWrap=true}; }
            GUI.backgroundColor=new Color(.025f,.16f,.11f); GUI.contentColor=new Color(1,.87f,.6f);
            GUI.Box(new Rect(16,12,300,83),""); GUI.Label(new Rect(30,18,280,40),"DOMINÓ PATIO RD",heading); GUI.Label(new Rect(30,58,280,35),"Terraza · prototipo 3D",label);
            GUI.Box(new Rect(465,12,350,78),""); GUI.Label(new Rect(480,24,330,60),$"Nosotros {game.Scores[0]}     Ellos {game.Scores[1]}\nManos: {wins[0]} / {wins[1]} · Meta 200",label);
            GUI.Label(new Rect(20,110,240,90),"Carlos · bot\nAna · tu frente · bot\nLuis · bot",label);
            if(Button(new Rect(1100,16,160,44),sound?"Audio: sí":"Audio: no"))sound=!sound;
            if(!accepted)
            {
                GUI.Box(new Rect(310,180,660,330),""); GUI.Label(new Rect(335,200,610,220),"Patio RD / 1\n4 jugadores · parejas 0–2 y 1–3 · doble seis\nPrimera salida 6–6 · sin pozo · paso automático\nDominó/tranque: todas las pintas restantes\nTranque: trancador contra rival a su derecha; empate al trancador\nBonos 25: capicúa estricta, pase de salida y paso corrido\nBonos de paso no cierran la meta. Sin reloj en modo local.",label);
                if(Button(new Rect(440,440,400,50),"Aceptar reglas y jugar")) accepted=true;
                return;
            }
            GUI.Label(new Rect(320,480,900,50),message,label);
            if(game.Result!=null)
            {
                var r=game.Result; bool final=game.Scores.Any(s=>s>=rules.Target);
                GUI.Box(new Rect(300,220,680,230),""); GUI.Label(new Rect(325,240,630,140),$"{r.Reason} · asiento {r.Winner}\nCuenta: {r.Points} · Capicúa: {r.Capicua}\n{(final?"Partida cerrada":"Mano completada")}"+(final&&game.Scores.Any(s=>s==0)?" · ¡Lisa de marcador!":"")+(final&&wins.Any(w=>w==0)?" · Sin manos ganadas":""),label);
                if(Button(new Rect(440,380,400,50),final?"Revancha":"Siguiente mano")) { if(final){wins[0]=wins[1]=0;Deal(null,null);}else Deal(game.Scores,r.Winner); }
                return;
            }
            GUI.Label(new Rect(450,535,700,35),game.Turn==0?"Tu turno · selecciona y confirma":"Turno del asiento "+game.Turn,label);
            var hand=ascending?game.Hand(0).OrderBy(t=>t.Pips).ToArray():game.Hand(0).OrderByDescending(t=>t.Pips).ToArray();
            for(int i=0;i<hand.Length;i++)
            {
                var t=hand[i]; GUI.backgroundColor=selected.HasValue&&selected.Value.Equals(t)?new Color(.6f,.4f,.1f):new Color(.06f,.2f,.13f);
                GUI.enabled=game.Turn==0;
                if(Button(new Rect(260+i*105,580,95,65),t.ToString())) { selected=t; selectedEnd=null; }
            }
            GUI.enabled=true; GUI.backgroundColor=new Color(.025f,.16f,.11f);
            if(Button(new Rect(20,600,200,45),"Ordenar mano"))ascending=!ascending;
            if(selected.HasValue)
            {
                foreach(End end in new[]{End.Left,End.Right})
                {
                    GUI.enabled=game.CanPlay(0,selected.Value,end);
                    if(Button(new Rect(end==End.Left?300:520,660,210,45),(selectedEnd==end?"✓ ":"")+(end==End.Left?"Punta izquierda":"Punta derecha")))selectedEnd=end;
                }
                GUI.enabled=selectedEnd.HasValue;
                if(Button(new Rect(750,660,200,45),"Confirmar"))Commit(selected.Value,selectedEnd.Value);
                GUI.enabled=true; if(Button(new Rect(970,660,200,45),"Cancelar")) {selected=null;selectedEnd=null;}
            }
        }
    }
}
