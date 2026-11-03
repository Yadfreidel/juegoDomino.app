# Dominó Caos

En **Crear mesa**, elige Dominó Caos y su variante visual o con reglas. El botón ✦ junto a tu mano abre cuatro poderes por página. Selecciona, consulta, elige rival o ficha cuando corresponda y activa. Escape cancela; las flechas recorren los controles. Clásico sigue siendo el valor predeterminado.

## Arquitectura

- `Chaos.cs`: identificadores, comandos, evento y límites centrales (3 por jugador/mano, 1 por turno).
- `PracticeChaos.cs`: autoridad local compartida por HTTP y WebAssembly, validación, aleatoriedad, escudos, deduplicación y consumo. Los bots usan los cinco poderes de reglas en esa variante.
- `Game.cs`: operaciones de manos y sentido, sin reglas visuales. Reparto conserva cantidades y cadena; se cancela sin consumir si deja el turno actual sin ninguna jugada. La salida obligatoria 6–6 se conserva.
- `chaos-effects.js`: Three.js, partículas y recursos compartidos; poses guardadas/restauradas, copias de la mesa para desbaratar, rayos, humo, corona, escarcha y efectos de impacto. No hay dependencias nuevas. Calidad baja/media/alta limita las partículas a 30/64/120.
- `chaos-menu.js`: menú radial con páginas, objetivos, confirmación y cancelación.

Los efectos manuales duran 2,4 segundos (desbarate: 3,6). Los visuales bloquean colocaciones temporalmente en la autoridad; los controles de ajustes y salida siguen disponibles. El volumen, vibración y movimiento reducido usan las preferencias existentes. El movimiento de cámara Caos tiene control independiente. Tranca/capicúa usan exclusivamente `Game.Result`, no consumen usos. Un doble nuevo activa electricidad automática. La siguiente colocación rompe la escarcha.

## Transporte y privacidad

`POST /api/power` / `PracticeBridge.Power` aceptan `PowerCommand`. El asiento humano se fija en la autoridad; el cliente no elige quién actúa. Eventos llevan ID, jugador, objetivo, semilla e inicio. La mirada solo aparece en el snapshot humano cuando ese humano es el usuario autorizado; una mirada de un bot nunca publica su ficha. No se serializan manos completas rivales. Un escudo bloquea ataques directos (cambio o mirada); el reparto es global.

Esto es práctica local con tres bots. El servidor WebSocket experimental independiente conserva su protocolo clásico; no se presenta como Caos en línea. HTTP conserva usos y estado al recargar mientras vive el proceso. WebAssembly conserva la práctica solo durante la vida de la página, igual que antes. No hay persistencia nueva en disco ni sincronización ficticia.

## Verificación

`tools/verify.ps1`, pruebas Node de layout/cliente/lanzamientos y `chaos.spec.mjs`. Esta última comprueba menú en 1440×900 y 390×844, activación real, ausencia de errores de página y restauración exacta de posiciones/cuaterniones/escalas de los 12 efectos. También cancela un desbarate y verifica que no quedan copias visibles. Las pruebas de autoridad cubren rechazo sin consumo, idempotencia, límite por turno, clásico, conservación de fichas y escudo/privacidad.

Los gráficos son procedurales y estilizados, sin modelos externos de dragón ni simulación de fluidos. Móvil se verifica en Chromium emulado; falta medir en teléfonos físicos.
