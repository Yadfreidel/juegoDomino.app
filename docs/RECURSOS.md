# Inventario y licencias

| Recurso | Procedencia | Estado / licencia |
|---|---|---|
| Imagen adjunta | Usuario, referencia visual | No se distribuye ni se usa como textura; derechos no inferidos |
| Mesa, fichas/pintas y mar | Geometría procedural del código de este proyecto | Original, provisional |
| Palmeras y patio | Primitivas generadas por código | Original, provisional. Los avatares web se retiraron el 2 de noviembre de 2026 |
| Bandera de la República Dominicana (`src/Domino.Desktop/wwwroot/assets/bandera-republica-dominicana.svg`) | [Wikimedia Commons, File:Flag_of_the_Dominican_Republic.svg](https://commons.wikimedia.org/wiki/File:Flag_of_the_Dominican_Republic.svg) | **Dominio público** según los metadatos del archivo. Descargada el 2 de noviembre de 2026; revisada sin scripts ni recursos externos |
| Mesa de dominó web (marco, paño, soportes, franjas) | Geometría procedural en `table-model.js`, modelada a partir de la imagen de referencia | Original; la imagen de referencia no se incluye ni se usa como textura |
| Materiales PBR de mesa y fichas (`materials.js`) | Parámetros físicos en código; madera y tapete usan los escaneos de abajo | Original. Marfil: veteado y rugosidad generados por ruido en código, sin texturas externas |
| Madera del marco y los soportes (`assets/textures/nogal-color.jpg`, `nogal-rugosidad.jpg`, `nogal-normal.jpg`) | [Poly Haven, American Walnut Veneer](https://polyhaven.com/a/american_walnut_veneer), autora Jenelle van Heerden. Mapas de 1k (color, rugosidad, normal OpenGL) descargados el 2 de noviembre de 2026 desde `dl.polyhaven.org` | **CC0** (dominio público). Al color se le aumentó el contraste ×2,3 y se recomprimió; el tono caoba se aplica en el material |
| Tapete (`assets/textures/lino-color.jpg`, `lino-rugosidad.jpg`, `lino-normal.jpg`) | [Poly Haven, Rough Linen](https://polyhaven.com/a/rough_linen), fotografía de colormass y procesado de Rico Cilliers. Mapas de 1k descargados el 2 de noviembre de 2026 | **CC0**. Reducidos a 512 px; el color se pasó a escala de grises (el verde lo pone el material) |
| Golpe de ficha | Síntesis seno con caída exponencial | Original; no grabación ni voces externas |
| Tipografía | GUI predeterminada de Unity | Recurso del motor; sujeto a términos de Unity |
| URP, Input System | Registro oficial de Unity | Licencias incluidas con paquetes; resolución e inventario final pendientes de editor |
| .NET / ASP.NET | Microsoft | Componentes de runtime/SDK; licencias de sus distribuciones |
| Three.js 0.180.0, BufferGeometryUtils y RoomEnvironment (GLTFLoader retirado con los avatares) | Paquete oficial `three@0.180.0` servido por jsDelivr; `examples/jsm/environments/RoomEnvironment.js` añadido el 2 de noviembre de 2026 a `vendor/environments/` sin modificar | MIT; texto en `src/Domino.Desktop/wwwroot/vendor/THREE-LICENSE.txt` |
| Texturas web de piedra, madera del entorno, sombras de contacto y oclusión del borde del paño | Canvas procedural en este proyecto | Originales, sin fotografías descargadas |
| Iluminación ambiental | `RoomEnvironment` prefiltrado con `PMREMGenerator` en la GPU al iniciar | Generado, sin archivo HDR descargado |
| Música ambiental web | Acorde sintetizado en Web Audio | Original, sin grabaciones externas; volumen independiente |
| Playwright 1.64.1 / Chromium de pruebas | Registro npm y CDN oficial Playwright | Herramienta de desarrollo; no se incluye el navegador en la app |

No se descargaron modelos, música ni recursos de pago. Las únicas descargas gráficas son los dos juegos de texturas CC0 indicados, guardados en el proyecto (no se enlazan en tiempo de ejecución). No hay voces, micrófono, chat, apuestas ni servicios contratados. El código entregado no agrega una licencia de distribución al proyecto por cuenta del propietario.
