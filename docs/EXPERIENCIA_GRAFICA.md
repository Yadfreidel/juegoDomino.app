# Mesa de referencia, cámara elevada y recorrido de práctica

## Revisión 5 (2 de noviembre de 2026): identidad «Quisqueya Competitivo»

Rediseño completo según la imagen de referencia, sobre la misma arquitectura (HTML/CSS, Three.js r180, motor C#). Reglas, reparto, turnos y puntuación no cambian.

- **Tema** `theme.css`: paleta azul noche, azul y rojo de la bandera, cian para turno y selección, tipografías Exo 2 / Barlow (OFL, autoalojadas), espaciado, bordes luminosos y estados. `screens.css` (portada, paneles, diálogos) y `game.css` (HUD vertical y horizontal) solo usan esos tokens.
- **Portada**: logo con dos fichas, render real de la mesa (`assets/portada.webp`, generado con `tests/visual/render-cover.mjs`), botones Jugar ahora (rojo), Crear mesa, Unirme, Practicar y «Volver a mi partida» solo si hay partida. Jugar ahora abre una mesa contra bots con tu última configuración; el juego en línea sigue sin existir y Unirme lo indica.
- **Mesa**: fieltro azul, reverso azul en las fichas rivales (miran hacia la mesa), placa con la bandera centrada en mi riel, sala oscura «Club de dominó» (nuevo escenario predeterminado; C# acepta `club`).
- **Exactamente cuatro jugadores**: Tú (abajo), compañero (arriba), rivales a los lados; el turno se marca con icono y texto, no solo color.
- **Vertical**: mesa alta (3,3 × 5,7) y cadena transpuesta en columnas, sin girar asientos ni reducir fichas. **Horizontal**: mesa ancha. Rotar solo cambia la presentación (prueba: mismas 26 fichas, misma revisión, ninguna escritura al servidor).
- **HUD**: marcador compacto, «Tu turno» y temporizador real (deadline del servidor), mensajes rápidos plegados en un botón, resultado con pintas, capicúa y bonos reales. No hay «Robar» (no hay pozo con 4 jugadores) ni «Pasar»: los pasos siguen siendo automáticos.

**Comprobado**: 13 pruebas Node (incluye cadena y encuadre verticales), práctica C# (78), Playwright 9/9, y `tests/visual/captures.mjs` en 360×800, 390×844, 430×932, 800×360, 844×390, 932×430 y 1440×900 sin recortes, con 4 etiquetas, 7 fichas ≥ 41 px y 0 caras rivales. Capturas `docs/capturas/quisqueya-*.png`.

**Pendiente**: medición en teléfonos reales; juego en línea; la pantalla «choice» antigua queda sin enlace.

## Revisión 4 (2 de noviembre de 2026): materiales físicos, fichas con cavidades e iluminación PBR

Mejora gráfica sobre el mismo motor (Three.js r180 vendorizado, sin migración ni motores adicionales). Reglas, puntuación, turnos, sincronización, cámara y controles no cambian.

**Arquitectura.** Cada responsabilidad gráfica tiene su módulo, sin dependencias hacia la lógica del juego:

| Módulo | Responsabilidad |
|---|---|
| `tile-geometry.js` | Geometría física de la ficha: losa biselada con normales suavizadas, cara superior con un agujero por punto, bisel de marfil en el borde de cada agujero, copa negra y ranura central. Una geometría por par de valores (28 como máximo), cacheada y compartida |
| `materials.js` | Texturas PBR (color, rugosidad, normal) a escala física, materiales de mesa y fichas, sombras de contacto horneadas y ruido procedural del marfil |
| `lighting.js` | Espacio de color, mapeo tonal, entorno prefiltrado, luz principal con sombras y luces de relleno |
| `graphics-quality.js` | Perfiles baja/media/alta (datos puros) |
| `tile-presenter.js` / `table-model.js` | Montan las piezas a partir de lo anterior; los materiales se inyectan desde la escena |

**Mesa.** El marco, el faldón, los soportes y las patas usan el escaneo CC0 *American Walnut Veneer* teñido a caoba, con mapas de rugosidad y normales y UV en unidades de mesa. Una repetición equivale a ~9,5 unidades (unos 45 cm a la escala de la ficha), así que la veta no se ve gigante y no se repite dentro del marco. Los soportes pasan de cajas a losas biseladas. El tapete usa *Rough Linen* CC0 (512 px, en gris y teñido en el material): trama fina, rugosidad ~1 y sin brillo. Las mallas planas de sombra blanda dan peso bajo la mesa, bajo cada soporte y en el borde del paño, sin invadir la zona de la cadena. La bandera mantiene su placa, ahora de latón con reflejo de entorno y esmalte mate.

**Fichas.** Tienen grosor real, esquinas redondeadas y bisel suave con normales suavizadas. **Los puntos y la línea central son cavidades geométricas**, no texturas: un labio de marfil redondeado y una copa pintada casi negra. El doble seis completo está verificado por prueba: una cavidad por punto en su mitad, sin solaparse y dentro de la cara, con 28 geometrías compartidas. Hay tres variantes de marfil (tono, rugosidad y desplazamiento del veteado) y un giro de ±0,6° que se eligen por la identidad de la ficha, de modo que una ficha nunca cambia de aspecto entre snapshots. Cada ficha de la cadena son 2 llamadas de dibujo más su sombra de contacto. El reverso de las fichas rivales es una losa lisa con una incrustación de bajo contraste. Antes era un punto oscuro, que podía leerse como un valor. `opponentFaces` cuenta ahora las mallas de pintura de cara en los soportes y sigue en 0. La previsualización es marfil translúcido con tinte menta y puntos oscuros visibles. Las fichas HTML de la mano usan el mismo marfil, con puntos hundidos y línea incisa en SVG.

**Color e iluminación.** Salida sRGB y `NeutralToneMapping`, que conserva el blanco del marfil y el verde del paño. La luz principal es cálida, alta y lateral, con la intensidad de sombra al 72 %. Se suman un hemisferio cálido, un relleno desde el lado del jugador y dos faroles. El entorno es un `RoomEnvironment` prefiltrado con PMREM en la GPU (sin descargar HDR) y **se aplica solo a los materiales de mesa y fichas**: aplicado a toda la escena duplicaba el coste del fotograma sin mejora visible. Nunca se muestra como fondo. No hay bloom, profundidad de campo, desenfoque ni SSAO: la oclusión ambiental se resuelve con las sombras de contacto horneadas, sin ruido ni coste por fotograma. El contraste medido entre la cara y el punto en las capturas es de 12,5:1 a 13,9:1 (luminancia relativa WCAG).

**Perfiles de calidad**

| | Baja | Media (predeterminada) | Alta |
|---|---|---|---|
| Resolución máxima | 1× | 1,25× | 2× |
| Sombras en tiempo real | No (solo de contacto) | PCF 1024 | PCF suave 2048 |
| Reflejos de entorno | No | Sí | Sí |
| Barniz (clearcoat) | No | No | Sí |
| Anisotropía | 2 | 4 | 8 |
| FPS objetivo | 30 | 60 | 60 |

El mapa de sombras solo se redibuja cuando algo se mueve (jugada, arrastre, cambio de soportes o de calidad), porque no depende de la cámara. Las geometrías se crean una vez y se cachean, y los materiales no se recalculan por fotograma. `dispose()` libera geometrías, materiales, texturas, el entorno PMREM y el mapa de sombras.

**Rendimiento medido** (Chromium 156 headless con **SwiftShader**, es decir, WebGL por CPU sin GPU, en este equipo; no representa un teléfono ni una GPU real):

| Vista | Calidad | Fotograma medio (p95) | Llamadas de dibujo | Triángulos |
|---|---|---|---|---|
| PC 1440×900, partida real | media | 701 ms (833) | 104 | 68 912 |
| Móvil 390×844, partida real | media | 182 ms (200) | 108 | 70 011 |
| PC 1440×900, perfilado | baja | 293 ms | 102 | — |
| Cadena de 26 + soportes llenos, 844×390 | cualquiera | — | 177 | 129 117 |

Referencia de la revisión anterior en el mismo entorno: 279 ms en PC con calidad media. La calidad baja queda prácticamente igual que antes. Media y alta cuestan más por píxel en la CPU. **No hay mediciones en teléfonos ni GPU físicas, por lo que no se afirma ninguna tasa de FPS en dispositivos reales.**

**Validación**
- `tools/verify.ps1`: dominio (828 215 comprobaciones), práctica, servidor e integración: PASS.
- `node --test` de layout, cliente y la nueva `tile-geometry.test.mjs` (doble seis, orientación de caras y perfiles): PASS.
- Playwright, ejecución completa con la versión final: 8 de 9. La que faltaba, «pareja», falló contra una instancia de 5091 compilada antes de esa funcionalidad (su snapshot no incluía `partner`). Tras `play.ps1 -Restart` pasa por separado. La prueba de partida completa en PC amplía su límite de 240 s a 480 s por el coste del renderizado por software (tardó 3,2 min).
- `tests/visual/captures.mjs` genera las capturas de revisión con escenas fijas (una cadena de 26 con los siete dobles y una partida corta), sin errores de página.

**Capturas:** [PC cadena 26](capturas/realista-pc-cadena-26.png) · [PC partida](capturas/realista-pc-partida.png) · [PC selección](capturas/realista-pc-seleccion.png) · [PC inspección](capturas/realista-pc-inspeccion.png) · [móvil horizontal cadena 26](capturas/realista-movil-h-cadena-26.png) · [móvil horizontal partida](capturas/realista-movil-h-partida.png) · [selección](capturas/realista-movil-h-seleccion.png) · [inspección](capturas/realista-movil-h-inspeccion.png) · [vertical](capturas/realista-movil-v-cadena-26.png) · [calidad baja](capturas/realista-calidad-low.png) / [media](capturas/realista-calidad-medium.png) / [alta](capturas/realista-calidad-high.png)

**Pendiente**
- Medir en teléfonos y GPU reales, y ajustar los perfiles con esos datos.
- El decorado del patio (muros, palmeras, piso) sigue siendo geometría procedural provisional, sin PBR.
- Las fichas de la mano siguen siendo botones HTML con SVG, por accesibilidad, no objetos 3D.
- No hay mapas de AO ni de desplazamiento: la oclusión es horneada y aproximada.
- Los rincones de los soportes y las patas usan proyección UV simple: puede haber pequeñas costuras de veta, apenas visibles desde la cámara de juego.

## Revisión 3 (2 de noviembre de 2026): mesa de la referencia, sin personajes

Esta revisión **sustituye la primera persona y los personajes** descritos en las revisiones 1 y 2. Esas secciones se conservan como historial. Sus capturas (`pc-primera-persona.png`, `movil-*-primera-persona.png`, etc.) ya no reflejan la app actual.

**Qué cambió**
- **Personajes retirados.** Desaparecen figuras, manos, sillas, animaciones de brazo y el cargador de modelos opcionales (`avatar-rig.js`, `avatar-models.js`, `models/avatars.json`, `vendor/addons/GLTFLoader.js`). Antes de borrarlos se comprobó que solo los usaba la escena; `BufferGeometryUtils` se conserva porque la escena la comparte. También se quitaron las mesitas con farol junto a la mesa. Los cuatro jugadores lógicos, asientos, parejas, nombres, turnos y bots no cambian (son datos del servidor). Cada jugador se representa con una etiqueta compacta: nombre, cantidad de fichas, señal de turno (borde y punto verdes) y botón de silencio.
- **Mesa** (`table-model.js`), geometría propia basada en la imagen de referencia:
  - marco grueso de caoba barnizada, extruido con esquinas redondeadas y bisel de 5 segmentos;
  - faldón y patas;
  - paño mate con textura de fibra procedural;
  - cuatro soportes bajos sobre el marco;
  - franjas azul, blanca y roja en la cara frontal y arcos tricolor en las esquinas;
  - bandera oficial con escudo en una placa dorada del borde frontal.

  La imagen adjunta **no se usa como textura ni como fondo**.
- **Bandera:** `assets/bandera-republica-dominicana.svg`, de Wikimedia Commons, dominio público. Se revisó que el SVG no tiene scripts ni referencias externas. La placa está a la izquierda del centro del borde frontal. Centrada, como en la referencia, quedaría siempre detrás de tu mano, que ocupa el centro inferior de la pantalla.
- **Fichas** (`tile-presenter.js`): objetos 3D independientes con grosor, bisel, marfil satinado, puntos casi negros, línea central y sombra de contacto. Las del compañero y los rivales usan `reverse()`: un cuerpo sin geometría de puntos, apoyado en su soporte. `patioDiagnostics().opponentFaces` cuenta mallas de puntos en los soportes (resultado medido: 0).
- **Cámara elevada** (`camera-controller.js`). Busca la inclinación más pronunciada (70°→27°) con la que el marco ocupa ~90 % del ancho útil, cumpliendo dos condiciones: todo el paño y el borde lejano entre el marcador y tu mano, dentro de las zonas seguras. El borde cercano (tu soporte) puede quedar detrás de tu mano. El cálculo se repite al cambiar el tamaño, la orientación o el espacio de la interfaz.
- **Mirar alrededor:** solo una pequeña inclinación (±0,14 / ±0,1 rad) y zoom acotado. La cámara siempre está en tu lado y por encima, y los soportes rivales no tienen caras.
- **«Inspeccionar»:** vista casi cenital de la cadena con un tamaño mínimo de 88 px por ficha. Si la cadena no cabe, se recorre arrastrando, siempre dentro del paño. Las fichas nunca se reducen por debajo de ese tamaño. «Centrar mesa» vuelve a la vista completa.
- **Interfaz compacta en horizontal:** marcador en una línea, controles en la esquina superior derecha, sin rótulos decorativos y mano grande abajo. En vertical la mesa ocupa el ancho completo y se sugiere girar el teléfono.
- **Colocación.** La interacción ya existía y no cambia, salvo la nueva animación:
  - selección por toque;
  - puntas válidas resaltadas, con botones si hay dos;
  - previsualización con orientación y confirmación opcional en Ajustes;
  - cancelación y arrastre;
  - marcadores fijados al borde si un destino queda fuera de vista.

  La jugada aceptada se anima desde el soporte del jugador hasta su posición, solo después del snapshot del servidor.
- **Cadena:** `chain-layout.js` mantiene la serpentina con dos puntas, sin superposiciones y dentro del paño (probado de 0 a 28 fichas).

**Capturas (Chromium, renderizado por software):** [PC](capturas/mesa-pc-partida.png) · [PC con cadena de 26](capturas/mesa-pc-cadena-26.png) · [PC inspección](capturas/mesa-pc-inspeccion.png) · [móvil horizontal 844×390](capturas/mesa-movil-h-partida.png) · [móvil horizontal con cadena de 26](capturas/mesa-movil-h-cadena-26.png) · [inspección móvil](capturas/mesa-movil-h-inspeccion.png) · [740×360](capturas/mesa-movil-h-pequeno-partida.png) · [932×430 con cadena](capturas/mesa-movil-h-grande-cadena-26.png) · [vertical](capturas/mesa-movil-v-partida.png)

**Pendiente o provisional**
- Texturas de madera y paño procedurales, sin mapas de normales ni reflejos de entorno. El brillo «barnizado» proviene de las luces.
- Las fichas propias siguen siendo botones HTML grandes (accesibles con teclado y lector), no objetos 3D en tu soporte.
- Sin medición en teléfonos reales ni GPU física.


## Revisión 2 (2 de noviembre de 2026): ojos del jugador, reglas de la casa y parejas

- **Cámara real en primera persona.** En PC y en horizontal la cámara está en los ojos del asiento 0 (`EYE` en `camera-controller.js`), por delante de la cabeza oculta y detrás del borde de la mesa. Antes estaba unas cuatro unidades detrás de la silla. El campo de visión se calcula según la proporción de la pantalla para que entren los tres jugadores. Giro sentado: ±0,62 rad en horizontal, 0,24 rad hacia arriba y 0,32 rad hacia abajo. El punto de vista no se desplaza al mirar, así que no puede atravesar objetos ni ver detrás de los soportes rivales.
- **Teléfono en vertical.** Desde la altura de los ojos, una pantalla estrecha no puede mostrar el ancho de la mesa. El jugador se «inclina» sobre su borde de la mesa y se encuadra una fila completa de siete fichas. Los extremos de una cadena larga se alcanzan girando la vista o con «Ver tablero». Es una decisión de legibilidad, no una vista literal desde los ojos.
- **Ver tablero.** Muestra la mesa completa desde arriba, por encima de vigas y guirnaldas (que se ocultan), con transición suave. «Centrar mesa» devuelve la vista a la silla. Con «Reducir movimiento» el cambio es inmediato.
- **Destinos fuera de vista.** Si un extremo legal queda fuera del encuadre, su marcador se fija al borde con una flecha. Se puede tocar o servir de destino al arrastrar. La cámara nunca se mueve sola.
- **Manos propias.** Los antebrazos descansan sobre el borde de la mesa y se ven en PC y en horizontal. Al jugar, la mano se estira hacia el destino. En vertical se ven pequeñas por la postura inclinada.
- **Etiquetas de jugador** ancladas por encima de cada cabeza, para no tapar la cadena. Incluyen un botón para silenciar.
- **Gestos.** Además de la cancelación previa, se cancelan con `lostpointercapture`, `orientationchange` y al ocultarse la página.
- **Parejas.** El anfitrión elige pareja (Ana, Carlos o Luis) o un sorteo que se resuelve al crear la mesa. La autoridad C# devuelve `seats`. La sala, el marcador, los nombres, los resultados y la posición de los personajes 3D salen de ahí y se mantienen entre manos.
- **Reglas de la casa.** Sección desplegable con salida posterior, conteo, tranque, empate y cada bonificación con su condición exacta. Los valores predeterminados son Patio RD / 1 sin cambios. Véase [REGLAS.md](REGLAS.md).
- **Sala.** Los asientos se generan desde el estado autoritativo. Cambiar condiciones anuncia qué cambió y obliga a confirmar de nuevo; los bots confirman solos.
- **Mensajes rápidos.** Frases propias y reacciones de los bots a eventos públicos (pasar, dominó, tranque, capicúa, paso corrido). Se activan por mesa. Cada jugador se puede silenciar y el silencio se guarda en las preferencias locales. No hay voz.

### Salir, abandonar y desconectarse (práctica local)

| Situación | Comportamiento |
|---|---|
| Salir de la sala antes de empezar | `leave`: borra la configuración activa. No hay reparto ni marcador que perder. |
| Volver al patio durante la partida | La partida se conserva y el reloj sigue. «Volver a mi partida activa» aparece en el inicio. |
| Terminar la práctica | `leave`: abandono definitivo, se reinician marcador y victorias. |
| Desconexión o recarga | La cookie recupera la misma práctica. Si hay reloj y vence, se juega la menor ficha legal. Se pierde al reiniciar el proceso del servidor. |

En línea, la política sigue siendo la del servidor experimental: el mismo token recupera asiento y plazo, sin reserva de 60 s ni abandono implementados.

### Pendiente real (sin simulación)

Pública, privada con código, unirse a una mesa en línea, sincronización de cuentas, voz y pausa. El cliente gráfico sigue sin transporte WebSocket. «Unirme con código» solo valida el formato. Las opciones en línea se muestran desactivadas con su motivo. Abrir ajustes no pausa la práctica.

Actualización del 2 de noviembre de 2026. Se modificó la app existente de Three.js/ASP.NET Core, manteniendo las bibliotecas y el motor C#. La petición posterior de primera persona sustituye la cámara sobre el hombro propuesta inicialmente.

## Funciona

Inicio → Configuración → Sala de espera → Partida → Resultado → Siguiente mano/revancha. Inicio → Práctica conserva los valores de producto: 200, sin reloj y bots intermedios. Solo se reparten fichas cuando el humano pulsa «Estoy listo»; los tres bots están listos automáticamente. Configurar una mesa activa se rechaza en C#, sin reiniciar puntuaciones. Cambiar condiciones antes de empezar exige volver a confirmar.

Configuración validada en `PracticeSettings`: nombre, metas 100/150/200, tiempo 0/15/30/45, bonos conjuntos 0/25/30, patio/terraza y dificultad. No se cambió silenciosamente la salida, el conteo completo, los equipos o la política de empate. No se exponen variantes de conteo/tranque aún sin implementar. Parejas fijas Tú–Ana y Carlos–Luis, claramente indicadas; elección de equipos pendiente del cliente en línea.

Los bots usan solo su mano y las puntas públicas. Fácil elige lexicográficamente; intermedio conserva la estrategia previa de mayor suma de pintas; difícil evalúa la continuidad de su mano después de colocar. No se atribuye al nivel difícil una superioridad estadística medida.

Reloj: deadline autoritativo y fecha del servidor en el snapshot. Al vencer se coloca la menor ficha legal por A, B y extremo izquierdo. Un comando tardío resuelve primero el vencimiento y se rechaza si su revisión quedó atrás. Abrir ajustes o volver al inicio no detiene el polling ni reinicia el plazo. Con la página cerrada, la práctica resuelve el turno vencido al volver a consultar; no simula todos los turnos que habrían ocurrido sin clientes. Esto difiere del ticker continuo del servidor WebSocket experimental.

## Cámara y colocación

La vista local muestra brazos y manos y excluye la cabeza, el torso y las piernas propios. Mirar modifica la orientación desde el mismo punto de vista, no una órbita alrededor de otros asientos. *(Revisión 1, sustituida: véase la revisión 2 arriba.)* La vista elevada y el zoom son acciones explícitas. Las jugadas no reposicionan automáticamente la cámara.

Botón derecho + ratón para mirar; un dedo desde el escenario mira; dos dedos hacen zoom. Desde la ficha se inicia su arrastre. Los paneles están fuera de la superficie de entrada del canvas. `pointercancel`, pérdida de foco y redimensionado cancelan los gestos. La cubierta se oculta cuando obstruiría la cámara elevada; las posiciones y el giro acotados evitan entrar en los asientos rivales.

Seleccionar eleva la ficha de la bandeja y dibuja únicamente destinos provenientes de `moves`, calculados en C#. Cada destino muestra una ficha semitransparente con pintas orientadas y dobles transversales. Las áreas táctiles tienen 60–72 px y no cambian el tamaño de la ficha. Arrastrar intersecta el rayo de cámara con el plano de mesa; cerca de un extremo válido, la copia converge suavemente hacia él. Soltar fuera devuelve la ficha a la bandeja y no envía comandos. El bloqueo de envío y la revisión impiden duplicar acciones. No hay retirada optimista de la mano: la animación sigue al snapshot autorizado.

«Elegir extremo» ofrece una alternativa por teclado/botones. La confirmación es opcional y persistente. La bandeja se alimenta de una única mano autorizada; no hay una segunda copia lógica en un soporte 3D propio. Los soportes rivales solo crean dorsos sin geometría de pintas: girar o elevar la cámara no puede revelar información inexistente.

`chain-layout.js` calcula exclusivamente posiciones desde la cadena ordenada. Reserva espacio para ambos extremos, admite las 28 posiciones, gira al cambiar de fila y no abre ramas. Se prueban límites y separación incluyendo dobles. Después de una jugada la distribución puede recolocarse suavemente dentro de la mesa; no es una simulación física de fichas contiguas. Algunas uniones en los giros conservan separación visual, pendiente de refinamiento artístico.

## Recursos, límites y sustitución de personajes

Los personajes siguen siendo **modelos procedurales de sustitución**, ahora articulados y con proporciones menos caricaturescas, dedos, respiración, parpadeo, mirada y gesto de brazo. No son humanos realistas terminados ni capturas de movimiento. El alcance del brazo se limita y las manos se mantienen sobre el plano; la ficha se desplaza visualmente desde el asiento hasta su destino, sin afectar reglas ni reloj. Falta arte humano de producción, rig y animaciones de colocación con contacto preciso.

`models/avatars.json` comienza vacío porque no hay modelos humanos apropiados con licencia verificada. Para añadir uno que el propietario pueda distribuir:

```json
[
  {
    "enabled": true,
    "seat": 1,
    "url": "/models/personaje-sentado.glb",
    "scale": 1,
    "offset": [0, 0, 0],
    "yaw": 0,
    "license": "IDENTIFICADOR Y ARCHIVO DE LICENCIA REAL",
    "source": "PROCEDENCIA REAL DEL RECURSO"
  }
]
```

El adaptador carga GLB con el `GLTFLoader` oficial y sustituye la figura de ese asiento. El modelo debe estar sentado, orientado hacia +Z local y ajustado a la altura de mesa; debe incluir su silla si reemplaza la figura completa. Se reproducen clips cuyos nombres incluyan Idle/Breath y Place/Play si existen. Para asiento 0 solo se admite un recurso separado de manos/brazos con `firstPersonOnly: true`; no se acepta automáticamente una malla humana completa que vuelva a tapar la cámara. Validar escala, clips y colisiones reales tras incorporar el recurso. No se descargaron personajes de procedencia incierta para aparentar realismo.

## Separación de responsabilidades

| Archivo | Responsabilidad |
|---|---|
| `Domino.Domain/Runtime/Game.cs` | Reglas existentes, sin cambios en esta mejora |
| `Domino.Application/PracticeMatch.cs` | Ciclo de práctica, configuración, bots, reloj y snapshot privado |
| `Domino.Application/PracticeSettings.cs` | Combinaciones admitidas y validación |
| `camera-controller.js` | Vista, sensibilidad, límites, gestos y conversión pantalla/mesa |
| `chain-layout.js` | Distribución determinista de fichas |
| `placement-controller.js` | Selección, arrastre, confirmación y bloqueo de envíos |
| `scene.js` | Renderizado, materiales, recursos y animación visual de fichas |
| `table-model.js` | Mesa 3D, soportes con reversos, bandera y franjas (rev. 3; sustituye a los avatares) |
| `tile-presenter.js` | Geometría y materiales de fichas: caras visibles y reversos sin puntos |
| `navigation.js` | Inicio, configuración, sala, perfil local y recuperación |
| `table-roster.js` | Nombres, parejas y resumen legible de condiciones y reglas |
| `table-chat.js` | Mensajes rápidos, reacciones de bots y silencio por jugador |
| `preferences.js`, `personal-settings.js` | Preferencias persistentes y su aplicación |
| `game-client.js` | Acciones y snapshots de la autoridad existente |
| `sound.js` | Efectos y ambiente sintetizado, volumen y silencio |

Materiales/geometrías de fichas se reutilizan; puntos instanciados y figuras de mesa agrupadas por material. Se agrupa decoración estática para reducir llamadas. Media/baja usan sombra de contacto texturada; alta añade sombras selectivas a 2048. Calidad baja limita el bucle a un objetivo de 30, sin prometer alcanzarlo. Media/alta apuntan a 60. Se liberan geometrías, materiales, texturas, instancias y renderer al cerrar la página.

## Verificación ejecutada

- C#: 816,948 comprobaciones del dominio, 5,200 manos. Se volvió a ejecutar sin modificar las reglas.
- Práctica: 64 comprobaciones de configuración válida/inválida, sala sin reparto, ready repetido, reglas bloqueadas, timeout, comando tardío, bots de tres niveles, privacidad, cuenta y continuación.
- Servidor WebSocket preexistente: 20 comprobaciones con cuatro clientes, reinicio y reconexión. Esto **no significa que el cliente gráfico ya tenga multijugador**.
- Node: tres pruebas de distribución/cámara, cubriendo longitudes 0–28 con distintas mezclas de dobles, determinismo, límites, ausencia de solapamientos, destinos y rayos de pantalla con un canvas desplazado. Mirar no mueve el asiento y crecer la cadena no mueve la cámara.
- Playwright: seis escenarios aprobados en ejecuciones por grupos: selección y cancelación; ambos extremos y confirmación; doble envío; arrastre inválido/válido; cámara/preferencias; recorrido real completo hasta resultado y siguiente mano; refresco; diseño y toque móvil; capturas reales. Los escenarios de interacción puntual emplean fixtures declaradas en el test. El recorrido de PC y las capturas «real/actual» usan la autoridad C# y reparto real, sin sustituir la API.
- Un primer recorrido real excedió 120 s en el navegador por software cuando quedaban dos fichas. Se amplió el presupuesto de la prueba a 240 s y la mano completa pasó. Una captura móvil inicial falló antes del primer frame; se esperó explícitamente el render y pasó. No se presentan esos intentos iniciales como aprobados.
- JavaScript analizado con `node --check`; C# compilado Release. Sin errores de aplicación en las sesiones de medición.

## Capturas

Revisión 2 (Chromium headless, renderizado por software):

- [PC · primera persona con destinos](capturas/pc-primera-persona.png)
- [PC · mirando a un lado](capturas/pc-mirar-lado.png)
- [PC · Ver tablero](capturas/pc-ver-tablero.png)
- [PC · configuración con reglas de la casa](capturas/pc-config.png) · [sala](capturas/pc-sala.png)
- [Móvil vertical · partida](capturas/movil-vertical-primera-persona.png) · [inicio](capturas/movil-inicio.png) · [configuración](capturas/movil-config.png) · [sala](capturas/movil-sala.png)
- [Móvil horizontal · partida](capturas/movil-horizontal-primera-persona.png) · [inicio](capturas/movil-horizontal-inicio.png)

Revisión 1:

- [Inicio PC](capturas/pc-inicio.png)
- [Práctica PC con destino seleccionado](capturas/pc-partida-actual.png)
- [Cuenta real de una mano](capturas/pc-resultado.png)
- [Práctica real en móvil vertical](capturas/movil-partida-actual.png)
- [Práctica real en móvil horizontal](capturas/movil-horizontal-actual.png)
- [Vista elevada móvil](capturas/movil-tablero-real.png)

Las capturas móviles son emulación de viewport y entrada táctil en Chromium, **no ejecución en un teléfono**.

## Rendimiento medido y pendiente

`tests/visual/benchmark.mjs`: Chromium headless, calidad media, DPR 1, calentamiento 4 s + muestra de 10 s, escena con mano de siete fichas y 0–2 fichas centrales según quién recibió el doble seis. Renderizador detectado: **ANGLE / Vulkan SwiftShader (software)**. Resultados de esa muestra: PC 1440×900, media 279.0 ms (~3.6 FPS), p95 316.7 ms, 136 llamadas; móvil emulado 390×844, media 76.2 ms (~13.1 FPS), p95 83.4 ms, 148 llamadas. El entorno por software no alcanzó los objetivos. No son mediciones de GPU física ni de un teléfono y no validan 60 FPS. Datos completos en [rendimiento-local.json](capturas/rendimiento-local.json).

Pendientes: perfilar con aceleración gráfica y dispositivos Android/iOS reales, escenarios con cadena larga y sesiones de al menos 10 minutos; integrar personajes licenciados y animaciones finales; comprobar gestos en Safari/Chrome móviles reales y vibración; conectar el cliente al transporte WebSocket, sala privada/códigos reales, matchmaking y cuentas. La migración PostgreSQL y Unity/VR conservan sus límites anteriores. No se publicó infraestructura.
