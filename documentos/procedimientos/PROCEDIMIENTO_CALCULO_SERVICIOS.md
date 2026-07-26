# Procedimiento de Carga y Cálculo de Servicios — Kaptura

**Qué es esto:** el procedimiento operativo fijo que Claude sigue para procesar un servicio de transporte, desde que llega el documento/mensaje hasta que queda cerrado en Kaptura con costos y margen reales. Construido y validado con un caso real completo (S-53, Felipe Vidal, 18/19-07-2026).

**Principio rector:** Claude resuelve todo lo que pueda por sí mismo consultando Supabase directamente. Solo pregunta al usuario lo que genuinamente no existe en ningún lado del sistema.

---

## Paso 0 — Confirmar contexto

1. ¿Qué empresa? (`flota_297221` Madrid / `global_solutions` Global Solutions)
2. Si es Global Solutions: pedir al usuario la captura de la pantalla **Disponibilidad** del día del servicio (la tabla en Supabase está vacía por un bug de permisos ya corregido el 18-07 — confirmar si ya está guardando antes de asumir que sigue vacía).

## Paso 1 — Extraer datos del documento

De la foto de guía/factura y del mensaje de WhatsApp que la acompaña, extraer: fecha, origen, destino, patente, conductor, N° de guía.

⚠️ **Checkpoint obligatorio, siempre:** antes de cerrar cualquier servicio, preguntar explícitamente *"¿Estas son TODAS las guías de este servicio/ciclo, o falta alguna (incluyendo regreso o devolución)?"* — un chofer puede mandar varias guías de "término de ruta" en momentos separados del mismo ciclo (ida, entrega, regreso con devolución), y no todas llegan juntas. Error real cometido: se cerró un servicio con 2 guías pensando que era el ciclo completo, y apareció una 3ra guía días después que resultó ser otro servicio entero sin capturar.

## Paso 2 — Verificar TODO contra Supabase antes de preguntar nada

| Dato | Tabla a consultar | Qué buscar |
|---|---|---|
| Patente | `kaptura_flota` | Que exista, `tipo_operacion`, `rendimiento_km_lt` |
| Conductor | `kaptura_conductores` | Que exista, activo |
| Cliente | `kaptura_clientes` | **Nombre EXACTO como está registrado** — nunca asumir la ortografía leyendo el documento (error real: "Pressetta" leído vs "Presmita" registrado) |
| Tarifa | `kaptura_tarifarios` | Por cliente + origen + destino — normalmente ya está cargada, no hace falta preguntar |
| Reglas fijas | Sección de reglas por empresa (más abajo) | Solo como respaldo si no hay documento mejor — la fuente real (guía, proforma) siempre manda por encima de la regla general |

## Paso 3 — Reconstruir el recorrido real completo por GPS

**Nunca asumir que el km es solo la ida.** Sumar TODOS los tramos `trip` de `kaptura_gps_eventos` que pertenecen al mismo servicio (ida + vuelta si el camión regresa a base).

**Todo servicio tiene hasta 3 tramos — identificar y calcular los 3 SIEMPRE, no solo el de carga:**

| Tramo | Estado | Va en el campo |
|---|---|---|
| Base → Origen | VACÍO | `km_base_carga` (0 si Base=Origen) |
| Origen → Destino | CARGADO | `km_carga_destino` |
| Destino → Base (o siguiente servicio) | VACÍO | `km_retorno` |

**Km Vacíos totales = `km_base_carga` + `km_retorno`** (nunca reportar solo uno de los dos — error real cometido y corregido el 19-07-2026, donde un servicio con 231km de regreso vacío se mostraba con "0 km vacíos" porque el informe solo sumaba el primer tramo).

⚠️ **Límite real, no automatizable:** si el camión cruza medianoche y el mismo día arranca un servicio distinto (otro cliente/ruta), alguien tiene que decidir manualmente dónde termina un servicio y empieza el otro (ej. contarlo como 1,5 días). El GPS muestra la actividad pero no puede decidir a qué servicio pertenece — **esto siempre requiere confirmación humana**.

`km_total` = suma completa de los 3 tramos (round trip completo si aplica).

## Paso 4 — Calcular costos con la fórmula fija

```
total_costos = costo_combustible + costo_peajes + costo_conductor + costo_comision_conductor
             + costo_fijo_dia + costo_mantencion + costo_viaticos + costo_contingencia
             + costo_corretaje + costo_adicional + factoring

margen_servicio = ingreso_total − total_costos
```

**Nunca insertar un servicio sin calcular TODOS estos campos.** Si un dato real no existe, usar 0 explícito (nunca `null`) y anotar en `notas` que es estimado.

⚠️ **CRÍTICO — marcadores obligatorios en `notas` para que el informe se vea completo:**
```
notas = "[contexto libre]|_HORAS:{salida_base,llegada_origen,salida_destino,llegada_base}|_PUNTOS:[{tipo,destino,valor,num_guia,guias}]"
```
La columna `puntos_asignados` NO se usa para mostrar puntos en el informe — solo el marcador `|_PUNTOS:` dentro de `notas`. Sin esto, el informe muestra puntos genéricos ("Punto 1") en vez del destino real. Además, `hora_inicio`/`hora_termino` (timestamps) son obligatorios en servicios multi-día — el timeline de GPS del informe depende de que estén seteados para mostrar todos los días, no solo el primero.

### Fuente de cada variable (Global Solutions, valores vigentes desde 19-07-2026):

| Variable | Fórmula | Fuente |
|---|---|---|
| `costo_combustible` | km_total ÷ rendimiento_km_lt × precio_litro | rendimiento: `kaptura_flota`. precio_litro: `kaptura_config` ($1.200). **Usar siempre el teórico para el margen — nunca la cartola real** (la cartola sirve para recalibrar el rendimiento en el tiempo, no para el margen del servicio) |
| `costo_peajes` | Total del corredor que matchea origen→destino | `kaptura_corredores` (`total_tag` + `total_peajes`) |
| `costo_conductor` | dias_servicio × $33.000 | `kaptura_config`. Mismo valor para todos, incluso Pablo Riquelme/Sebastián Zúñiga cuando actúan como chofer (su sueldo de cargo normal — $1.500.000/$900.000 — no aplica en ese rol) |
| `costo_comision_conductor` | ingreso_total × 8% | `kaptura_config` (`comision_conductor`) |
| `costo_fijo_dia` | (costo_fijo_mensual ÷ 20 días operativos ÷ equipos operativos ese día) × dias_servicio | Mensual $3.500.000 en `kaptura_config`. **Equipos operativos: SOLO desde la captura de Disponibilidad que pasa el usuario — nunca contar desde `servicios_piloto` (subregistrado) ni GPS como primera opción** |
| `costo_mantencion` | km_total × ($250.000 ÷ 10.000km) = km_total × $25 | `kaptura_config` (`mant_costo`, `mant_km`) |
| `costo_viaticos` | dias_servicio × $12.000 | `kaptura_config` (`viatico_dia`) |
| `costo_contingencia` | dias_servicio × $25.000 | `kaptura_config` (`fondo_contingencia`) |
| `costo_corretaje` | ingreso × 1,19 × % del cliente | `kaptura_clientes` (`comision_generador_pct`) — **en Global Solutions siempre es 0%, no existe ese modelo para ningún cliente** (Sollem, Presmita, Citrus Agro, Los Montes confirmados en 0%) |
| `factoring` | ingreso × 3% | **Solo si cliente = Sollem.** Para cualquier otro cliente, 0. |

## Paso 5 — Lo que NUNCA se podrá automatizar (requiere siempre a una persona)

1. **Puntos intermedios de la ruta** cuando el servicio tiene múltiples destinos — no existen en ningún documento.
2. **Reparto de días** cuando un camión encadena dos servicios distintos sin volver a base.
3. **Confirmar un dato ilegible** en la foto (ej. patente borrosa) — Claude puede cruzarlo contra `kaptura_flota` para sugerir, pero no inventar.

## Paso 6 — Antes de insertar/actualizar en Supabase

1. Presentar la tabla completa de costos calculados.
2. Esperar autorización explícita del usuario ("Autoriza"/"OK").
3. Insertar con la fórmula del Paso 4 aplicada completa — no insertar servicios "a medias".

## Paso 7 — Auditoría cruzada obligatoria al cerrar

1. Revisar el **servicio siguiente** de ese mismo equipo — de dónde arranca confirma dónde terminó el que se cierra.
2. Revisar el **servicio anterior** de ese mismo equipo — dónde terminó confirma de dónde arrancó el que se cierra.
3. Cruzar contra **todas** las fuentes disponibles, no solo GPS: `disponibilidad`, `kaptura_flota`, `kaptura_conductores`, `kaptura_clientes`, `kaptura_tarifarios`, `kaptura_corredores`.
4. `dias_servicio` = días con actividad real (carga + reparto), nunca el rango completo de calendario — los días de espera parado en base no cuentan.

---

## Valores de Setup vigentes — Global Solutions (`kaptura_config`), cargados el 19-07-2026

| Clave | Valor |
|---|---|
| `viatico_dia` | 12.000 |
| `comision_conductor` | 8% |
| `costo_fijo_mensual` | 3.500.000 |
| `modo_costo_fijo` | automático |
| `fondo_contingencia` | 25.000/día |
| `mant_costo` | 250.000 |
| `mant_km` | 10.000 |
| `sueldo_diario` (por conductor) | 33.000 — parejo para todos |

*(Estos valores viven en Supabase, no en este documento — si cambian en Setup, este documento queda desactualizado hasta que se revise de nuevo.)*

---

## Caso de referencia — S-53 (Felipe Vidal, Coltauco→Valparaíso, 02/03-07-2026)

Usado para construir y validar este procedimiento completo, paso a paso, con datos 100% reales.

| Ítem | Monto |
|---|---|
| Ingreso | $450.000 |
| Combustible (484km÷3,5×$1.200) | $165.943 |
| Peajes (corredor C7) | $22.895 |
| Costo Conductor (1,5 día) | $49.500 |
| Comisión Conductor (8%) | $36.000 |
| Costo Fijo (1,5 día, 2 equipos) | $131.250 |
| Mantención (484km×$25) | $12.100 |
| Viático (1,5 día) | $18.000 |
| Contingencia (1,5 día) | $37.500 |
| Corretaje | $0 |
| Factoring | $0 |
| **Total Costos** | **$473.188** |
| **Margen real** | **−$23.188 (pérdida)** |

El primer cálculo (antes de aplicar este procedimiento completo) había dado +$252.465 — un error de +$275.653 causado por: contar solo el km de ida, no considerar el 1,5 día real, y omitir mantención/contingencia/comisión. Este procedimiento existe para que ese error no se repita.

---

## ADENDA — Aprendizaje del workstream de Presupuesto/Conciliación (25-07-2026)

*Detalle completo en `MEMORIA_PRESUPUESTO_Y_CONCILIACION.md`. Acá solo lo que cruza directo con el cierre de servicios reales de este documento.*

- **Factoring de Sollem confirmado: 3% sobre la tarifa BRUTA (con IVA)**, no sobre la neta. La tabla de la sección "Fuente de cada variable" de este documento decía "ingreso × 3%" sin especificar neto/bruto — queda aclarado: es sobre bruto.
- **Servicios multipunto (Sollem) generan km adicional real, no solo tarifa adicional** — evidencia de 2 casos reales (S-58, S-60): comparando km GPS real vs. km de ida+vuelta al destino principal, cada punto adicional agrega **~120km reales** (rango observado: 113-128,5km). Al reconstruir el recorrido por GPS (Paso 3 de este procedimiento) para un servicio multipunto, este es el orden de magnitud esperado de km extra por punto — no asumir que el punto adicional es "gratis" en distancia.
- **Costo Fijo Equipo real de Sollem: ~$29.167/día** (evidencia de `costo_fijo_dia` en S-58/S-59/S-60) — dato real para cruzar contra el Setup de Kaptura si se necesita en otro contexto.
- **Peajes reales observados en `servicios_piloto` para rutas Sollem vía Casablanca: ~$22.895 flat por servicio**, sin variar por día ni destino — coincide con el corredor C7 ya documentado para el caso S-53. Para el presupuesto (no el cierre real) se usa $50.000/servicio como estimación de negocio, por decisión explícita del usuario, no por ser el dato más preciso disponible.

*Última actualización de esta adenda: 25-07-2026.*

---

*Documento vivo — actualizar cada vez que cambie una regla en Setup o se descubra un caso nuevo no cubierto aquí.*
