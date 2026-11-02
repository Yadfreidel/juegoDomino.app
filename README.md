# Dominó Patio RD

App gráfica local en `src/Domino.Desktop`: Three.js para la mesa 3D y C# para la autoridad de práctica. Incluye inicio, configuración, sala de espera, partida con tres bots, resultados y continuación. Conserva el motor probado, el servidor WebSocket experimental y el proyecto Unity. **El arte humano sigue siendo provisional; no es una versión móvil/VR de distribución.**

## Abrir la app gráfica

```powershell
.\tools\play.ps1
```

Abre **http://127.0.0.1:5091/**. Si el sistema no permite abrir el navegador automáticamente, ejecuta `tools/play.ps1 -NoBrowser` y abre el enlace manualmente. Para otra instancia usa `-Port 5090` o `-Port 5092`. El script reutiliza una instancia ya abierta; `-Restart` recompila y la reinicia, perdiendo su práctica en memoria. Si una pestaña antigua de 5090 no reconoce «Crear mesa», actualiza ese proceso con `tools/play.ps1 -Port 5090 -Restart` y recarga con Ctrl+F5. Las cookies de práctica se distinguen por puerto para que las instancias no se sobrescriban.

- **Crear mesa:** práctica local, objetivo 100/150/200, reloj 15/30/45 s o sin límite, pareja elegida o aleatoria, reglas de la casa, tres estrategias de bots y patio/terraza procedural. El reparto comienza al pulsar **Estoy listo** en la sala. Los otros asientos están identificados como bots, no como personas conectadas.
- **Practicar:** condiciones predeterminadas Patio RD, 200 puntos, sin reloj, bots intermedios. Pasa por la sala para aceptar las reglas.
- **Colocar:** toca una ficha y después su previsualización verde, o arrástrala al destino. Soltar fuera cancela. Escape o ✕ cancela la selección. En ajustes puedes pedir confirmación; «Elegir extremo» ofrece botones accesibles.
- **Mesa:** mesa 3D con materiales PBR: madera barnizada con veta escaneada (CC0) a escala física, tapete de tejido fino mate, soportes, franjas tricolor y bandera oficial, sin personajes. Las fichas tienen bordes redondeados y puntos y línea central hundidos de verdad (cavidades geométricas), con sombras de contacto. Los jugadores aparecen como etiquetas con nombre, fichas y turno. La cámara elevada se encuadra sola (~90 % del ancho útil, mejor en horizontal). **Inspeccionar** acerca la cadena y se recorre arrastrando; **Centrar mesa** vuelve a la vista completa. En PC, el botón derecho inclina ligeramente la vista. Los destinos fuera de vista aparecen en el borde con una flecha.
- **Parejas y reglas de la casa:** elige tu pareja o sortéala; variantes explícitas de salida, conteo, tranque, empate y bonificaciones, con Patio RD / 1 como predeterminado ([reglas](docs/REGLAS.md)).
- **Mensajes rápidos:** frases tuyas y reacciones de los bots; silencia a cualquier jugador con el altavoz de su etiqueta.
- **Preferencias:** volúmenes general/música/efectos, sensibilidad, inversión vertical, movimiento reducido, calidad baja/media/alta (baja: sin sombras en tiempo real ni reflejos, 30 FPS; media: sombras PCF 1024 y reflejos; alta: sombras suaves 2048, barniz y hasta 2× de resolución), vibración si el navegador ofrece la API, fichas grandes y confirmación. Se guardan localmente. Música ambiental sintetizada original, sin grabaciones externas ni voz.
- **Volver al patio** conserva la práctica; **Terminar esta práctica** la abandona. Recargar ofrece recuperarla. Las partidas de práctica se pierden al reiniciar el servidor; las preferencias y el perfil local permanecen en el navegador.

Pública, emparejamiento, entrada real por código, voz y cuentas en línea **no están integrados en este cliente**. Las pantallas informan la limitación y no simulan conexiones. El formulario de código solo comprueba el formato del identificador del servidor experimental. El perfil muestra únicamente el nombre y resultados locales realmente registrados.

Implementación, capturas y límites: [mejora gráfica](docs/EXPERIENCIA_GRAFICA.md). La versión Unity permanece separada y sin ejecutar en este entorno.

## Comprobar la versión gráfica

```powershell
.\tools\verify.ps1
node --test tests/visual/layout.test.mjs
node --test tests/visual/game-client.test.mjs
node --test tests/visual/tile-geometry.test.mjs
npm.cmd ci --prefix tests/visual
npm.cmd exec --prefix tests/visual -- playwright install chromium
# Con la app abierta en 5091:
npm.cmd test --prefix tests/visual
node tests/visual/benchmark.mjs
# Capturas de revisión gráfica (cadena larga, selección, inspección, tres calidades):
node tests/visual/captures.mjs
```

Las pruebas de navegador se ejecutan en un Chromium aislado, sin usar pestañas ni perfiles personales. El benchmark toma 4 s de calentamiento y 10 s de muestra por viewport; no reemplaza mediciones en teléfonos físicos.

## Herramientas adicionales de Windows

```powershell
# Solo si no tienes SDK: instala una copia local sin modificar PATH.
.\tools\bootstrap.ps1
# Motor y pruebas de integración; usa el puerto local 5187.
.\tools\verify.ps1
# Jugar con tres bots (acepta las reglas escribiendo SI).
.\.tools\dotnet\dotnet.exe run --project src/Domino.Console
# Servidor de desarrollo. Mantener abierto en otra terminal.
.\.tools\dotnet\dotnet.exe run --project src/Domino.Server --urls http://127.0.0.1:5080
```

La consola permite jugar manos sucesivas hasta 200. Cada ficha se elige por número y requiere confirmación. Los bots locales usan su mano y las jugadas legales, sin consultar manos rivales.

## Mesa 3D Unity

1. Instala Unity Hub y Unity **6.3 LTS**. La referencia reproducible inicial es `6000.3.0f1`; antes de distribución, actualizar al parche de seguridad soportado y repetir validación.
2. Añade y abre `unity/DominoPatioRD`. Espera la resolución de paquetes.
3. Ejecuta **Patio RD → Crear escena y configurar URP**. Genera `Assets/Patio.unity`, renderer y pipeline; no requiere copiar DLL.
4. Abre esa escena y pulsa Play. Acepta reglas; selecciona ficha, punta habilitada y Confirmar. Cancelar revierte la selección. Ordenar cambia solo la presentación de tu mano. Al cerrar, consulta la cuenta y continúa.
5. Instala Android Build Support (SDK/NDK/OpenJDK) o iOS Build Support para preparar compilaciones. iOS requiere además macOS/Xcode y firma. Ninguna compilación móvil ha sido ejecutada aquí.

Unity consume las fuentes de dominio mediante un paquete local UPM. El `.csproj` compila esas mismas fuentes contra .NET Standard 2.1. Los artefactos `bin/obj` quedan fuera del paquete. Contratos siguen la misma estructura; el transporte Unity en red aún no está conectado.

La mesa es geometría 3D real. Mar, palmeras, luces y tres avatares son geometría original provisional. La mano usa botones grandes de confirmación; la cadena usa fichas con puntos 3D. No hay imagen estática que sustituya la escena. Falta revisión visual en editor, legibilidad móvil y articulación visual continua en los giros de la cadena.

## Servidor experimental

`POST /tables` entrega código/ID, asiento 0 y token secreto; `POST /tables/{id}/join` reserva los siguientes asientos. El código es un identificador de invitación largo. `POST /tables/{id}/accept` requiere `Authorization: Bearer TOKEN`. Los cuatro deben aceptar antes del reparto.

Conecta `ws://127.0.0.1:5080/tables/{id}/ws` usando el mismo encabezado. Los snapshots incluyen reglas, tu mano, cantidades ajenas, cadena, marcador, turno, revisión, fecha límite y resultado. No incluyen el reparto ni las manos ajenas.

```json
{"id":"identificador-unico","revision":0,"a":6,"b":6,"end":"left"}
```

El servidor valida propiedad de ficha y turno. Un ID repetido con el mismo contenido devuelve el estado sin repetir efectos; reutilizarlo con otro contenido se rechaza. Un comando con revisión atrasada se rechaza. Snapshots cada 250 ms: solución simple provisional; sustituir por difusión al cambiar revisión antes de escalar.

Turno de 30 s: al vencer se elige la ficha con menor A, luego B y luego izquierda. No se pausa al desconectar; el mismo token recupera el asiento y el plazo original. El prototipo conserva el asiento indefinidamente, sin implementar todavía reserva de 60 s ni abandono. Los comandos confirmados se guardan antes de publicarse y se reproducen al reiniciar. `PATIO_DATA` elige la carpeta privada de persistencia; no compartirla porque contiene el reparto completo.

El servidor se ofrece solo en loopback por HTTP/WS durante desarrollo. HTTPS/WSS, proxy, gestión de certificados, cuentas y cliente móvil de autenticación son pendientes antes de acceso público. No publicar esta configuración directamente en Internet.

## Docker y PostgreSQL

```powershell
docker compose -f deploy/compose.yaml up --build server
```

Docker no estaba instalado, por lo que este despliegue no se ejecutó. El servidor usa volumen de archivos locales. `deploy/migrations/001_initial.sql` es un esquema inicial propuesto, **sin adaptador PostgreSQL integrado y sin prueba SQL**. El perfil opcional `postgres-preview` permite inspeccionarlo tras configurar `deploy/.env` desde el ejemplo. No es necesario para jugar ni probar el prototipo.

Consulta [reglas](docs/REGLAS.md), [arquitectura](docs/ARQUITECTURA.md), [validación y pendientes](docs/VALIDACION.md) e [inventario](docs/RECURSOS.md).
