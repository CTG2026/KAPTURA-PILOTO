# Memoria de Trabajo — Presupuesto, Flujo de Caja y Conciliación Bancaria (Global Solutions)

**Propósito de este documento:** procedimiento fijo y acumulado de reglas para que Claude arme y actualice el Presupuesto/Flujo de Caja de Global Solutions (Sollem + TRAST), lo concilie contra la cartola bancaria real y el SII, y mantenga el archivo Excel `Presupuesto_Flujo_Caja_Conciliacion_Ago_Sep_2026.xlsx` sin perder el aprendizaje entre sesiones. Es un documento hermano de `MEMORIA_TRABAJO_SERVICIOS.md` y `PROCEDIMIENTO_CALCULO_SERVICIOS.md` — esos cubren el cierre de servicios reales con GPS; este cubre la parte financiera/presupuestaria y su conciliación contra el banco y el SII.

---

## 1. Estructura fija del archivo Excel (orden obligatorio de hojas)

1. **`Supuestos_Presupuesto`** — todos los inputs (celdas azules), organizados en 3 bloques: SOLLEM, TRAST, COMPARTIDOS/EMPRESA. Cambiar cualquier valor acá recalcula todo el archivo.
2. **`Sollem`** — Ingreso, Costos Directos, Margen y Costeo por Km de Sollem, Agosto y Septiembre en columnas B/C.
3. **`TRAST`** — mismo formato que Sollem, para TRAST.
4. **`Consolidado`** — suma Sollem+TRAST, resta Costos de Estructura (no atribuibles a un cliente) → Estado de Resultados completo, más el Flujo de Caja semanal (base bruta/cash).
5. **`Conciliación_Junio`**, **`Conciliación_Julio`** — cruce real cartola vs RCV Compra/Venta SII, mes a mes.
6. **`Real_vs_Presupuesto`** — control semanal, vincula el Flujo de Caja de `Consolidado` con datos reales que se van llenando.
7. **`Resumen_Ejecutivo`** — Informe de Resultados Financieros (Estado de Resultados neto) + Plan vs Real vs Reproyección.

**Regla fija:** nunca insertar hojas nuevas en otro orden ni duplicar la lógica de Sollem/TRAST en Consolidado — Consolidado siempre debe ser fórmula que sume las hojas de cliente, nunca un cálculo independiente (evita discrepancias).

---

## 2. REGLA CRÍTICA — Ingreso Neto vs. Ingreso Bruto (IVA), nunca mezclar (25-07-2026)

**Error real cometido y corregido:** la primera versión del presupuesto comparaba Ingreso **bruto** (con IVA) contra una mezcla de costos donde solo Combustible venía bruto y el resto neto. Esto sobreestimó la "utilidad" en el equivalente al IVA cobrado (~19% del ingreso), que en realidad hay que devolverle al Fisco al mes siguiente — no es ganancia.

**Regla fija, aplica siempre:**
- **Estado de Resultados (utilidad real)** = SIEMPRE en base **neta** (sin IVA). Ingreso Neto − Costos Netos = Margen real.
- **Flujo de Caja (semanal)** = SIEMPRE en base **bruta** (con IVA, lo que efectivamente entra/sale del banco).
- Combustible: el precio de bomba ($1.200/lt Sollem, mismo para TRAST) YA incluye IVA — para el margen neto se divide por 1,19; para caja se usa el monto bruto completo.
- Peajes, Provisión/Contingencia, Sueldo, Viático, Comisión, Factoring: **no llevan IVA** (no son compras facturadas por terceros con IVA recuperable).
- Mantención: se trata como neto (dato ya viene sin IVA en el supuesto $25/km).
- Costo Fijo Estructural y Costo Cuenta Corriente: **no se dividen entre Sollem y TRAST** — son costos de la empresa completa, van solo en `Consolidado`.

---

## 3. REGLA — Tarifario de Agosto: qué columna usar (25-07-2026)

El archivo `Tarifas_Con_Baja_24-07_SOLLEM_AGOSTO_2026.xlsx` (hoja `CASABLANCA`, origen real de Sollem) tiene 3 columnas de tarifa por destino que **no son intercambiables**:

| Columna | Qué es | Uso correcto |
|---|---|---|
| `Tarifa Orig.` (F) | Tarifa histórica de referencia | No usar directo |
| `Nueva Tarifa` (I) = F×(1+Factor%) | **Es la tarifa ACTUAL/vigente hoy** — validado: calza exacto con el `tarifa_neta` ya cargado en `servicios_piloto` (ej. Requinoa $512.000, Peumo $512.000) | Usar solo para comparar contra el presente, NUNCA para presupuestar Agosto |
| `Nueva Tarifa Final (con baja 20,86% o 47,59%)` (columna R) | **Es la tarifa que regirá en AGOSTO** (el archivo se llama "Con_Baja" porque introduce una reducción desde Agosto) | **Esta es la que se debe usar para presupuestar Agosto/Septiembre en adelante** |

**Ojo:** el % de "baja" no es parejo — la mayoría de los destinos tiene 47,59% de baja, pero algunos (ej. San Fernando) tienen solo 20,86%. Siempre revisar la columna `Factor Baja` fila por fila, no asumir un % único.

**Advertencia estructural:** las hojas `PENCO` y `BULNES` del mismo archivo tienen un número de columnas distinto (`A1:T` vs `A1:Y` en `CASABLANCA`/`COPIAPO`) — al leer estas hojas por posición de columna, la columna "Tarifa Final" puede quedar mal indexada si no se verifica el header real fila por fila antes de asumir la posición.

---

## 4. REGLA — Puntos de entrega multipunto (Sollem), confirmada 25-07-2026

- **Todo servicio Sollem tiene un mínimo de 2 puntos de entrega** — nunca modelar un servicio con 1 solo punto como el caso base; el "+1 punto adicional" es la norma, no la excepción.
- **Tarifa del servicio** = Tarifa Agosto (columna "Final con baja") del **destino de mayor valor** de la ruta + **$60.000 neto por cada punto adicional** desde el 2°.
- **El punto adicional también agrega distancia real, no solo ingreso** — error real cometido y corregido: la primera versión sumaba el ingreso del punto adicional pero dejaba el km igual, como si el camión no se moviera. Evidencia real (2 casos, S-58 y S-60, comparando km GPS real vs. km de ida+vuelta al destino principal): **~120 km adicionales por cada punto adicional** (113km y 128,5km respectivamente, promedio 120,75 ≈ 120km). **Muestra chica (n=2)** — revisar y afinar cuando haya más servicios multipunto reales cerrados con GPS.
- Aplicar esta regla en ambos niveles: al presupuestar (Supuestos_Presupuesto → Sollem) y al cerrar un servicio real multipunto por SQL (ya cubierto en parte por la regla de conteo de puntos de `MEMORIA_TRABAJO_SERVICIOS.md`, sección 2nonies — esa regla cuenta puntos por N° de guías; esta memoria agrega el impacto en tarifa y km).

---

## 5. REGLA — Tasas confirmadas para el presupuesto de Sollem (25-07-2026)

Reemplazan supuestos anteriores marcados como estimados/en conflicto:

| Variable | Valor confirmado | Reemplaza a |
|---|---|---|
| **Peajes** | **$50.000 neto por servicio, flat** (no por día, no por km) | El supuesto de "$50.000/día" y también el dato real observado de $22.895/servicio en `servicios_piloto` — el usuario confirmó que ese dato real no se conoce con exactitud, y que $50.000/servicio es la mejor estimación de negocio a usar en el presupuesto |
| **Factoring** | **3% sobre la tarifa BRUTA (con IVA)** | El 6,4% observado en la única liquidación validada contra cartola (LIQ-001), y el 3% que aparecía en `servicios_piloto` pero calculado sobre neto — ambos quedan reemplazados por esta regla única y explícita |
| **Comisión Conductor** | 8% sobre la tarifa **NETA** (sin IVA) | Sin cambios — pero se deja explícito para no confundir con el factoring (que sí es sobre bruto) |
| **Costo Fijo Equipo (Sollem)** | **$29.167/día** (evidencia real: `costo_fijo_dia` de S-58/S-59/S-60 en `servicios_piloto`) | El estimado inicial de $36.000/día, que era prestado de TRAST por no tener dato propio de Sollem |
| **Costo Contingencia** | **$25.000/día** — línea que faltaba completa en el primer presupuesto armado | — |
| **Cadencia de servicios** | 1 servicio cada 1,5 días, de lunes a viernes | Consistente con "13 servicios/mes/equipo" ya usado |
| **"Provisión Fondo de Reserva $500.000/equipo/mes"** | **Eliminada del modelo** — no existe como categoría real en ningún servicio Sollem en `servicios_piloto`; fue reemplazada por Costo Contingencia ($25.000/día), que sí es real y evidenciada | — |

---

## 6. Metodología de Costeo por Km (estándar de mercado para transporte de carga)

Aplicar siempre esta estructura, tanto en `Sollem` como en `TRAST`, y verificar que el "Costo Total por Km" **reconcilie exactamente** con el Total de Costos Operacionales Directos ÷ Km — error real cometido y corregido: la primera versión del costeo por km omitía Peajes, Comisión y Provisión/Contingencia, lo que inflaba artificialmente el margen por km mostrado.

```
Costo Fijo por Km       = Costo Fijo del Equipo (prorrateado por día) ÷ Km del período
Costo Variable por Km   = (Combustible + Mantención + Peajes) ÷ Km del período
Costo Conductor por Km  = (Sueldo + Viático + Comisión) ÷ Km del período
Provisión/Contingencia por Km = Provisión ÷ Km del período
─────────────────────────────────────────────────────────
COSTO TOTAL POR KM      = Total Costos Operacionales Directos ÷ Km del período   ← debe calzar EXACTO con la suma de las 4 líneas de arriba
Tarifa por Km efectiva  = Ingreso Neto ÷ Km del período
Margen por Km           = Tarifa/Km − Costo Total/Km
```

---

## 7. Conciliación Bancaria — procedimiento confirmado y ya construido

1. Fuentes: Cartola bancaria (histórica o provisoria) + RCV Compra + RCV Venta del mismo período (SII).
2. ⚠️ **Cuidado con el corrimiento de columnas en los CSV del SII** — cuando el header tiene menos campos que la fila de datos, `pandas.read_csv` puede desalinear todo. Solución fija: `pd.read_csv(path, sep=';', index_col=False)`.
3. Cruce por monto exacto (redondeado) + fecha más cercana, marcando cada factura como "Pagada" (con referencia al movimiento de cartola) o "Sin identificar".
4. **Sollem se factoriza el 100% de sus facturas** — nunca esperar un abono directo del cliente en la cartola para Sollem; el abono real llega de la entidad de factoring (INCOFIN, Financia Capital u otras) por un monto menor a la factura (descontada la comisión de factoring).
5. Movimientos de cartola sin factura asociada: clasificar (Combustible, Factoring, Venta POS/Tarjeta, Transferencia conductor/personal, Transferencia interna, Otro) — nunca dejarlos sin explicar.
6. Cuadre de saldo obligatorio: Saldo Inicial + Abonos − Cargos = Saldo Final (según cartola) — diferencia debe ser $0, si no, hay un error de extracción de datos.
7. **Hallazgo real de esta sesión — módulo de factoring de Kaptura muy subregistrado:** de ~$11,7M en depósitos de factoring reales identificados en la cartola (junio+julio), Kaptura solo tenía 1 registro en `kaptura_cuentas_por_cobrar` (19% de cobertura) — mismo patrón de subregistro ya documentado para `servicios_piloto` en `MEMORIA_TRABAJO_SERVICIOS.md` sección 5.

---

## 8. Respaldo del archivo — mecanismo ya en uso

- El archivo Excel se respalda en GitHub (`ctg2026/KAPTURA-PILOTO/finanzas/conciliacion_bancaria/Presupuesto_Flujo_Caja_Conciliacion_Ago_Sep_2026.xlsx`), mismo mecanismo ya usado para guías y documentos de compliance (Supabase Storage no es alcanzable por las herramientas de Claude).
- **No se crea una tabla paralela en Supabase con los mismos datos del Excel** — se evaluó y se descartó por duplicación real de información. El Excel es la única fuente de verdad de la conciliación y el presupuesto; Supabase solo guarda lo que ya existía antes (`servicios_piloto`, `kaptura_cuentas_por_cobrar`, etc.), que mide otra cosa.

---

## 9. REGLA — Modelo operativo desde Agosto 2026 (confirmado 29-07-2026)

> **Fuente de verdad a partir del 30-07-2026: `kaptura_procedimientos`, código `PROC-FIN-14`** (aprobado por el Director) — define los 3 pilares (Rentable/Líquido/Solvente), umbrales (15% reproyección mensual, 75 días factoring, 32% operacional por servicio en `[OPE]`), la secuencia fija (persistencia primero, siempre), y la autoauditoría de 6 puntos antes de cualquier cierre. Esta memoria .md ya no repite ese contenido — solo referencia. Todo documento fuente (cartola, RCV, tarifario, etc.) se sube primero a GitHub (`documentos_financieros/{empresa}/`) y se registra en `kaptura_documentos_financieros` — ver Sección 8bis.

- **Pablo no participa en este proceso.** El usuario (Carlos, Director General) lo ejecuta directamente con Claude, con el mínimo esfuerzo posible de su parte — Claude baja/procesa/categoriza/presenta, no delega pasos manuales evitables a nadie.
- **Cuenta oficial única desde Agosto: Banco Santander 0-000-3776731-0 (Global Solutions SPA).** Todo el proceso recurrente (diario/semanal/mensual) se construye sobre esta cuenta exclusivamente.
- **Procedimiento explícito, sin ambigüedad Y sin retrabajo (corregido 29-07-2026, dos veces):**

  1. Entrar a **sii.cl** → Registro de Compras y Ventas → descargar **RCV Compra** (CSV) del mes en curso.
  2. Entrar a **sii.cl** → mismo lugar → descargar **RCV Venta** (CSV) del mes en curso.
  3. **Subir esos 2 archivos CSV directo en el chat** (adjuntar).
  4. Entrar a **Banco Santander Empresas** → Consulta de movimientos → descargar **cartola de movimientos** (Excel), cuenta 0-000-3776731-0.
  5. **Subir ese archivo Excel directo en el chat.**
  6. Claude cruza y actualiza automático: `Conciliación_[Mes]`, `Real_vs_Presupuesto`, `Resumen_Ejecutivo`, y actualiza `Bitácora_Saldo_Diario` tomando el saldo **directo de la última fila (columna SALDO) de la misma cartola de movimientos del paso 5** — NUNCA pedir un reporte de "Saldo de Cuentas Corrientes" aparte, sería un archivo duplicado para el mismo dato que la cartola ya trae.
  7. Claude presenta el resumen de resultados **en el chat** (no solo el archivo) y entrega el Excel actualizado.

- **Regla fija: Claude siempre presenta el informe/resumen de resultados en el chat, nunca solo el archivo sin comentario.**
- **Cadencia:** el usuario sube RCV+cartola con la frecuencia que le sea cómoda (ideal: diaria, mínimo: semanal) — mientras más seguido, más fina queda la `Bitácora_Saldo_Diario`. Cierre formal del mes en `Resumen_Ejecutivo` al terminar cada mes.
- **Categorización automática de movimientos de cartola sin factura RCV asociada — regla fija, ya en uso, mantener siempre:**

| Palabra clave en descripción | Categoría |
|---|---|
| ESMAX | Combustible |
| INCOFIN, FINANCIA CAPITA | Factoring confirmado (Sollem se factoriza 100%) |
| GETNET | Venta POS/Tarjeta (no es factura RCV) |
| TRANSF A / TRANSF DE | Transferencia conductor/personal |
| COMPRA NACIONAL | Compra con tarjeta (gasto operativo menor) |
| GLOBAL SOLUTION | Transferencia interna Global Solutions |
| (cualquier otro) | Otro / revisar manualmente |

## 10. REGLA — Cuentas paralelas: Santa Berenice y Mercado Pago son SOLO historia (29-07-2026)

- **"Sociedad de Transporte Santa Berenice SPA"** (cuenta antigua, Banco Estado/Santander distinta) y **"Global Solutions Spa Mercado Pago"** (billetera, usada principalmente para pagar combustible) **NO se concilian de forma continua** — son historia previa a agosto. Solo se revisan puntualmente si aparece una discrepancia real en la cuenta oficial que las involucre (ej. un cliente que pagó por error a la cuenta antigua).
- **Confirmado:** el pago de SOLLEM SPA por $2.136.590 (08-07-2026) a Santa Berenice **no fue pago de un servicio** — fue el reembolso de Sollem a Global por moras que Global tuvo que absorber ante el factoring por atrasos de pago de Sollem. No cruzar este monto contra ninguna factura RCV.
- **Confirmado: INCOFIN S.A. = LATAM TRADE CAPITAL** (misma entidad de factoring, no dos distintas — el correo de contacto real es `@latamtradecapital`).
- Santa Berenice también factoriza con Kapitalbox Logistic SPA (entidad adicional, distinta a Incofin/Financia Capital) — anotado solo como referencia histórica, no aplica a la cuenta oficial de agosto.

## 11. Tasas y supuestos finales confirmados para Sollem (actualización 29-07-2026)

Reemplaza cualquier valor anterior en conflicto:

| Variable | Valor final | Estado |
|---|---|---|
| Km base servicio 1 punto | **359 km** | Real, estudio 79 combos / 127 servicios Sexta Región |
| Km adicional por punto extra | **50 km** | Real, mediana 40km / promedio 50km, 35 pares GPS limpios de outliers |
| Puntos de entrega mínimo | **2** (siempre, sin excepción) | Confirmado — el "punto adicional" es la norma |
| Pago por punto adicional (neto) | **$60.000** | Confirmado |
| Tarifa por destino (Agosto) | Columna **"Nueva Tarifa Final" (con baja)** del tarifario Casablanca — NO la "Nueva Tarifa" (esa es la tarifa ACTUAL/vigente hoy, no la de agosto) | Confirmado, ver sección 3 |
| Tarifa multipunto | Tarifa Agosto del **destino de mayor valor** de la ruta + $60.000 × puntos adicionales | Confirmado |
| Peajes | **$50.000/servicio, flat** (no por día) | Sigue siendo la cifra de negocio elegida — **investigación en curso, ver sección 12, sin resolver. 29-07-2026: se recibió una instrucción afirmando "peajes llevan IVA, dividir por 1,19" sin ninguna evidencia real adjunta (boleta/comprobante), y en el mismo mensaje que la afirmaba también decía explícitamente que el tema seguía sin confirmar — contradicción real, NO aplicada. Requiere boleta real antes de cambiar esto.**
| Precio combustible | **$1.199/lt** | Real, promedio ponderado de 36 transacciones Aramco de julio 2026 (reemplaza el estimado de $1.200/lt — prácticamente idéntico, buena validación) |
| Factoring | **3% sobre tarifa BRUTA (con IVA)** | Confirmado, reemplaza definitivamente el 6,4% y el 3%-sobre-neto vistos antes |
| Comisión conductor | **8% sobre tarifa NETA (sin IVA)** | Confirmado |
| Costo Fijo Equipo | **$29.167/día** | Real, evidencia `costo_fijo_dia` en `servicios_piloto` |
| Contingencia | **$25.000/día** | Real, `costo_contingencia` en `servicios_piloto` |
| Cadencia de servicios | 1 servicio cada 1,5 días, L-V | Sin cambios |

**Resultado con la muestra ampliada de 15 combos (60 de 127 servicios reales):** Utilidad Neta promedio ponderada por servicio = **$117.444** (tarifa neta promedio $557.706, km promedio 413,2). La tabla completa de combos (con fórmulas dinámicas ligadas a `Supuestos_Presupuesto`) vive dentro de la hoja `Sollem`, al inicio, como memoria de cálculo — no está pegada a mano, se recalcula sola si cambia cualquier supuesto.

## 12. PENDIENTE CRÍTICO — Peajes reales: conflicto de $22.895 vs. $65.600 sin resolver (29-07-2026)

- `kaptura_corredores` (corredor C1, Coltauco↔Casablanca vía Ruta 5+Autopista Central+Ruta 68) dice el ciclo completo (ida+vuelta, 4 pórticos: Angostura, Autopista Central, Lo Prado, Zapata) cuesta **$22.895**.
- Pero la tabla de detalle real por pórtico `porticos_tag` (`valor_3_ejes`, tarifas 2026 verificadas para camión de 3 ejes) da: Angostura $9.000 + Autopista Central $7.400 + Lo Prado $8.200 + Zapata $8.200 = **$32.800 un sentido → $65.600 ida y vuelta**.
- **Estas dos fuentes de Kaptura se contradicen por casi 3 veces** y ambas podrían compartir el mismo error de origen (no son 2 fuentes independientes como se pensó al principio). El campo `nota` del corredor C1 no tiene memoria de cálculo, solo dice "MUST:Mostazal" (palabra clave de matching).
- **Sigue sin resolverse** — se necesita un comprobante real de TAG/cartola de un viaje Coltauco-Casablanca para saber cuál de los dos números es el correcto. Mientras tanto, el presupuesto sigue usando **$50.000/servicio** como cifra de negocio (ni una ni la otra), elegida deliberadamente como estimación conservadora ante la incertidumbre.



## 13. Pendientes reales, no resueltos

1. **Peajes: conflicto $22.895 vs $65.600 sin resolver** — ver sección 12, es el pendiente más importante abierto hoy.
2. **TRAST todavía no ha comenzado operaciones reales** — todo su presupuesto usa el combo de referencia del `Simulador_Combos_TRAST_V8.xlsx` (Padre Hurtado→Quilicura→Llay Llay→Talca→Talca, $1.020.777/2 días) como único caso disponible; reemplazar por el mix real de rutas apenas exista.
3. **Costo Fijo Equipo y Contingencia de TRAST** no tienen el mismo nivel de evidencia real que los de Sollem (vienen del simulador de combos, no de servicios TRAST ya cerrados) — revisar cuando existan datos reales.
4. **Bitácora de saldo diario** — todavía no está armada; es el primer paso operativo pendiente antes de que arranque agosto.
5. **Combos Sollem: muestra de 15 combos cubre 60 de 127 servicios (47%)** — si se necesita mayor precisión, ampliar la muestra a los 79 combos completos.

---

*Última actualización: 29-07-2026. Documento vivo — actualizar cada vez que se confirme un supuesto nuevo, se corrija un error de cálculo, o se cierre un pendiente.*
