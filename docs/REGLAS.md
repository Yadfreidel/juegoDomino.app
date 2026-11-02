# Patio RD / 1

Elección de producto; no representa una única tradición dominicana.

- 28 fichas doble seis; 4 asientos, 7 cada uno, sin pozo. Parejas por paridad, compañeros enfrentados. Secuencia derecha definida como 0→1→2→3→0. Primera salida 6–6; próximas salidas del jugador ganador de mano/tranque.
- Solo dos puntas; dobles sin ramas. No existe comando de paso: el motor pasa automáticamente los asientos sin jugada. Si el autor puede volver tras tres pases se mantiene la secuencia pendiente; el bono llega al colocar otra ficha, no al pasar.
- Dominó: mano vacía, cuenta todas las pintas restantes, incluidas las del compañero. Se evalúa antes del bloqueo. Se permite ganar una mano con cuenta cero.
- Tranque: ningún asiento puede colocar. Se compara trancador contra siguiente a su derecha; menor cuenta individual gana; empate al trancador. Se suman las cuatro manos.
- Capicúa estricta: última ficha no doble que coincide con ambas puntas anteriores, distintas entre sí. +25 al cerrar. Se evalúa antes de cambiar puntas.
- Paso corrido: tres pases y autor vuelve a colocar; +25. Puede repetirse. Cuatro pases cierran tranque sin ese bono.
- Pase de salida: primer rival pasa y compañero del salidor coloca. Si compañero pasa se cancela; si pasan tres se considera paso corrido sin duplicar salida.
- Bonos de paso se descartan enteros si alcanzarían o superarían meta. No se recortan a 199. Dominó, tranque y capicúa al cierre pueden alcanzar o superar 200.
- Cinco dobles no obliga a repartir. Lisa de marcador y ausencia de manos ganadas se distinguen en la presentación local y no otorgan puntos extra.

## Reglas de la casa (variantes explícitas)

Actualización del 2 de noviembre de 2026. `RuleSet` acepta variantes tipadas y validadas; **todos los valores predeterminados reproducen Patio RD / 1** (la batería de 5,000 manos da exactamente los mismos tranques, capicúas, pasos corridos y pases de salida que antes). Con variantes, `Version` pasa a `patio-rd/1+casa`.

| Apartado | Predeterminado | Alternativas | Decisión documentada |
|---|---|---|---|
| Salida primera mano | 6–6 obligatorio | — | Con 4×7 se reparten las 28 fichas: «doble más alto» siempre es 6–6, por eso no es configurable. |
| Salida manos siguientes (`NextOpening`) | Ganador de la mano | Rota a la derecha del salidor anterior; 6–6 obligatorio en cada mano | En mano nula sale el trancador con «ganador». |
| Conteo (`Counting`) | Pintas de las cuatro manos | Solo pintas de la pareja perdedora | Aplica igual a dominó y tranque. |
| Tranque (`BlockRule`) | Trancador contra rival a su derecha; menor individual gana | Suma por pareja; menor suma gana | Por parejas se acredita al asiento ganador con menos pintas (afecta solo a quién sale después). |
| Empate de tranque (`BlockTie`) | Gana el trancador / su pareja | Mano nula: 0 puntos, se reparte otra | La mano nula no suma victorias de mano ni bonos de capicúa; los bonos de paso ya obtenidos en esa mano se conservan. |
| Capicúa | +bono | Desactivable | Condición estricta descrita arriba; se suma al cerrar. |
| Paso corrido | +bono | Desactivable | Tres pases y vuelve a colocar el mismo jugador. |
| Pase de salida | +bono | Desactivable | Primer rival pasa y el compañero del salidor coloca. |
| Valor de bono | 25 | 0 / 30 | Un único valor para las tres bonificaciones. |

`PracticeSettings` traduce el formulario a estas variantes y rechaza cualquier valor no listado. El servidor WebSocket experimental sigue usando `new RuleSet()` (predeterminado) y no expone variantes.

La API `RuleSet` valida meta positiva, bono 0/25/30 y turno entre 5 y 120 segundos. El servidor actual fija 200/25/30. Capicúa ampliada (dobles), acumulación configurable, redeal por cinco dobles, series, abandono y competitivo no están implementados: no hay selección engañosa en la interfaz. Implementar políticas y pruebas antes de exponerlas.

La práctica gráfica añade `PracticeSettings` con valores explícitos: meta 100/150/200, bonos conjuntos 0/25/30 y tiempo 0/15/30/45. Cero representa «sin reloj» en aplicación; no cambia las reglas del dominio. El servidor WebSocket experimental conserva sus valores predeterminados. La sala de práctica resume la selección antes del reparto y las condiciones quedan bloqueadas al comenzar.
