# Verificación y pendientes

## Revisión 3: mesa de referencia sin personajes

- Node: 5/5 (distribución de 0 a 28 fichas dentro del paño; encuadre entre 85 y 95 % del ancho útil en 844×390, 740×360, 932×430, 1280×720 y 1440×900 con el paño entre marcador y mano; ancho completo en vertical; inspección con fichas de al menos 88 px y desplazamiento limitado al paño; centrar; ida y vuelta pantalla↔mesa).
- Playwright: 9/9. Incluye una mano real completa en PC y otra en móvil horizontal táctil, ambas puntas, cancelación, confirmación, doble envío, arrastre, recarga y reconexión de la práctica, y `opponentFaces = 0`.
- C#: reglas y servidor sin cambios en esta revisión; `tools/verify.ps1` se volvió a ejecutar.
- No verificado: teléfonos físicos, Safari/iOS, GPU real.


## Revisión 2 del cliente gráfico (primera persona, reglas de la casa, parejas)

Ejecutado el 2 de noviembre de 2026:

- `tools/verify.ps1`: dominio con 828,215 comprobaciones; las 5,000 manos predeterminadas mantienen las mismas cifras (1,263 tranques, 594 capicúas). Además, 6,000 manos con variantes: 379 tranques por pareja, 18 tranques nulos y 1,500 manos contando solo rivales. Práctica con 77 comprobaciones (parejas elegidas o aleatorias, variantes inválidas rechazadas, 6–6 en manos posteriores). Servidor compilado sin advertencias. Integración WebSocket: 20/20.
- Node: 5 pruebas de distribución, cámara (ojos fijos al mirar, límites, eje invertido, ida y vuelta de «Ver tablero», asiento propio en cuatro proporciones) y resúmenes de reglas y mensajes.
- Playwright: 8/8 escenarios contra una instancia nueva en el puerto 5093. Incluyen una mano real completa hasta el resultado, siguiente mano y recarga. También un escenario nuevo con pareja, variantes, aviso de cambios, salida de la sala, silencio persistente tras recargar y abandono. Las dos pruebas que fallaron al principio se corrigieron: límite de giro desactualizado y destino fuera de vista en primera persona, resuelto con marcadores fijados al borde. Además se cambió una espera en la prueba para evitar una carrera tras recargar.
- No verificado: teléfonos reales, Safari, GPU física, vibración real y Unity (sin editor). Unity comparte el dominio y solo usa `new RuleSet()`, pero no se compiló en el editor.

## Actualización del cliente gráfico local

Corrección posterior de «Unexpected end of JSON input» al crear mesa: se reprodujo `POST /api/configure` → 404 con cuerpo vacío en el proceso antiguo de 5090, mientras 5091 devolvía 200/JSON. Se recompiló y reinició 5090 con los endpoints actuales. El transporte ahora valida cuerpos vacíos, HTML, JSON truncado y snapshots incompatibles antes de actualizar la vista; un polling fallido no bloquea el reintento. Se añade aviso de conexión visible desde inicio, revalidación de recursos JS/HTML/CSS y cookies por puerto. Cuatro pruebas Node de transporte y una prueba de navegador de fallo/reintento verifican la corrección.

La app Three.js/ASP.NET Core ya incluye primera persona con manos, inicio, configuración de práctica, sala, colocación directa/arrastre, resultados y recuperación al recargar. Véase [EXPERIENCIA_GRAFICA.md](EXPERIENCIA_GRAFICA.md) para pruebas, capturas de PC/móvil emulado, mediciones por software y límites precisos. Ejecutar `tools/play.ps1` y abrir `http://127.0.0.1:5091/`.

Comprobaciones adicionales: 64 de aplicación de práctica, tres pruebas Node de distribución/cámara y seis escenarios Playwright aprobados por grupos, incluido un cierre real de mano y siguiente mano. El cliente gráfico no integra todavía el servidor multijugador experimental. Sus figuras siguen siendo provisionales. Los apartados siguientes describen el hito Unity y el servidor original; no implican que las nuevas capturas sean de Unity ni de móviles físicos.

Entorno: Windows x64; revisión del 2 de noviembre de 2026. Repositorio inicial vacío, sin AGENTS.md. Runtime .NET 10 disponible inicialmente; sin SDK. Se instaló SDK **10.0.403** en `.tools/dotnet`, sin cambiar PATH. No se encontraron Unity/Unity Hub en los directorios habituales ni ejecutable en PATH; Docker tampoco estaba disponible.

## Ejecutado

- Motor netstandard2.1 y servidor ASP.NET Core net10 compilados Release, cero errores y advertencias.
- Cliente de consola compilado Release. No se reporta una sesión humana manual como probada.
- Scripts de Unity analizados con el parser Roslyn en C# 9: cero errores de sintaxis. Esto no comprueba referencias a APIs de Unity ni sustituye compilar en el editor.
- Pruebas: **816,948 comprobaciones**, 5,000 manos deterministas y 200 adicionales con marcador cercano a meta. Incluyeron 1,263 tranques, 594 capicúas, 447 pasos corridos y 633 pases de salida confirmados.
- Se verificaron reparto único, aislamiento de copias, conservación de las 28 fichas tras cada acción, continuidad lógica de la cadena, rechazo fuera de turno y repetición, terminación, cuenta completa, salida siguiente y descarte de bonos al acercarse a meta.
- Integración: cuatro clientes reales `ClientWebSocket`, una mano completa, 20 comprobaciones, retraso artificial de comando de 60 ms, corte abrupto, reinicio del proceso, recuperación con mismo token/plazo, rechazo atrasado e idempotencia. La cantidad de colocaciones varía por reparto seguro. El corte abrupto representa pérdida total temporal de conexión; **no es una simulación estadística de pérdida de paquetes**.

## No verificado

- Compilación/ejecución de Unity y resolución efectiva de paquetes, UI, escena, audio o pruebas visuales de muchas fichas. No hay capturas de una escena ejecutada.
- APK, iOS, IL2CPP, dispositivos físicos, VR, Docker o migraciones PostgreSQL.
- Rendimiento en teléfonos físicos o VR no medido. Hay una muestra de Chromium por software para la app web, documentada aparte; no valida objetivos de dispositivos.
- Casos unitarios diseñados específicamente para empate, cero pintas final, doble final y secuencias de bonos repetidos extremas requieren fixtures adicionales; las simulaciones no sustituyen esa cobertura explícita.
- No hay prueba Unity→servidor, porque el adaptador de red del cliente aún no está implementado.

## Estado por hito

1. Motor y tests implementados y ejecutados; escena procedural implementada con humano/tres bots, cuenta y continuación. **Hito abierto hasta compilar y completar una mano en Unity.**
2. Avance: servidor autoritativo, invitación, cuatro aceptaciones, manos privadas, reloj y replay. Pendientes: sucesión de manos online hasta 200/revancha, integración Unity, reserva 60 s y abandono, cuentas, PostgreSQL, HTTPS/WSS y pruebas ampliadas. Persistencia de archivos solo una instancia.
3. Arte provisional. Pendientes: modelos licenciados, animaciones, interfaz final táctil, puntas destacadas, revisión geométrica de giros, iluminación horneada y optimización medida.
4. Sin adaptador VR. Objetivo propuesto Meta Quest 3 sentado con mandos vía OpenXR; confirmar visor disponible antes de fijar paquetes y 72/90 Hz. Sin tracking de manos implementado.
5. Sin matchmaking, perfiles, historial de usuario ni preparación de tiendas.

## Desbloquear la validación

Instalar Unity 6.3 LTS y módulos, abrir proyecto y ejecutar menú de configuración descrito en README. Corregir incompatibilidades que reporte el editor; generar lockfile de paquetes. Completar mano manual, tomar capturas de 28 posiciones y revisar a 1280×720 y 1920×1080. El editor no está instalado: no se inventó esta revisión.

Para rendimiento: candidatos **Samsung Galaxy A54** y **iPhone 13**, paisaje a resolución interna 1280×720, escena completa y mano de siete fichas, calentamiento 2 min + captura 10 min en dispositivo. Objetivo 60 FPS y perfil 30 para gama baja, medir CPU/GPU, memoria y percentiles. Son objetivos propuestos, sin hardware confirmado ni resultados. Quest 3: repetir sentado, resolución y frecuencia reales anotadas con profiler del visor. Antes de distribución definir perfiles gráficos, compresión, sombras, pooling y presupuestos a partir de esas mediciones.
