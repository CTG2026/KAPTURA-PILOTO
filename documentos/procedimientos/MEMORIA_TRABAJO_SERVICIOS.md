# Memoria Trabajo Automatización Servicios

**Propósito de este documento:** procedimiento fijo para que Claude procese guías/facturas de servicios de transporte (Madrid y Global Solutions), sin perder reglas ya acordadas ni repetir preguntas ya respondidas. También acumula las conclusiones del mapeo hacia la automatización, para no perder contexto entre sesiones.

**Regla general:** Claude debe intentar resolver todo lo que pueda por sí mismo (leer documentos, buscar en el código del sistema, aplicar reglas ya fijadas) antes de preguntarle al usuario. Solo se pregunta lo que genuinamente no se puede determinar de otra forma.

---

## 1. Procedimiento para cargar un servicio nuevo

1. Leer el documento (guía/factura/captura de WhatsApp) y extraer: fecha, origen, destino, patente, chofer, N° de guía.
2. Aplicar las reglas fijas de la sección 2 antes de preguntar nada.
3. Si falta un dato que no se puede inferir (tarifa, estado, empresa, o una regla fija no cubre el caso) → preguntar, nunca asumir.
4. Si un dato es ilegible o dudoso (ej. patente borrosa) → señalarlo explícitamente y pedir confirmación. Nunca cargar un dato "aproximado" sin marcarlo.
5. Presentar el mapeo completo (tabla campo→valor) antes de generar el SQL.
6. Esperar "Autoriza" / "OK" antes de entregar el SQL final (no se ejecuta directo — no hay conexión viva a Supabase en este chat).

---

## 2. Reglas fijas acordadas (por empresa)

### Transportes Madrid (`flota_297221`)
- Cliente por defecto en esta sesión: **EBLOOMS**
- Regla general (con excepciones reales confirmadas en la proforma de julio, ver más abajo): Coltauco→Santiago suele ser CWVH32/Cristóbal Núñez/$407.000; Coltauco→Chillán suele ser Esteban Acevedo (patente variable: ZV7780 o WY1742)/$576.000.
- ⚠️ **Estas reglas "siempre" son solo un respaldo cuando no hay documento fuente mejor.** La proforma oficial (`PROFORMA_Transporte_Madrid_julio_primera_quincena.xlsx`) mostró excepciones reales: 01-07 fue DZZW14 (no CWVH32), 06-07 fue con chofer Danilo Vergara (no Núñez). **La fuente de verdad siempre es el documento real, no la regla general.**
- No se guarda el RUT del chofer (no es un campo necesario en `servicios_piloto`).
- Julio 1ra quincena (01 al 15) ya fue cargado completo en el sistema mediante DELETE+INSERT transaccional basado en la proforma oficial.

### Global Solutions (`global_solutions`)
- Las guías llegan a un grupo de WhatsApp de coordinación ("TSBS Spa"), enviadas por los choferes **al término de la ruta**, no al inicio.
- Por eso, cuando se carga un servicio desde una guía de WhatsApp de Global, el estado correcto es **`ejecutado`** (no `cerrado`) — el viaje ya se hizo pero falta el cierre administrativo/financiero. `ejecutado` es un estado ya existente y válido en el sistema (confirmado en el código: tiene su propio botón "🔒 Cierre" para roles coordinador/controller/administrador).
- No hay reglas fijas de patente/chofer para Global todavía (a diferencia de Madrid) — cada servicio se procesa según lo que diga el documento.
- Cliente identificado hasta ahora: **PRESSETTA** (Comercializadora y Distribuidora de Frutos y Verduras Hernán Enrique Pressetta Chauffeur E.I.R.L.)

---

## 2bis. Reglas nuevas del procedimiento (agente) — 18-07-2026

- **Equipos operativos del día (para prorratear costo fijo):** buscar PRIMERO en la tabla `disponibilidad` de Supabase (proyecto `aqunzrukuruwzwywnurq`) — consultarla directo con `execute_sql`, no pedir captura de pantalla sin revisar antes. La tabla existía vacía por un bug de permisos RLS, **ya corregido el 18-07-2026** — puede que ya tenga datos reales, hay que comprobarlo cada vez, no asumir que sigue vacía. Si efectivamente no tiene el día que se necesita, usar como respaldo el conteo de equipos activos por GPS (`kaptura_gps_eventos`, patentes distintas con evento `trip` ese día) — **nunca** contar equipos desde `servicios_piloto` (subregistrado).
- **Combustible — dos registros con propósitos distintos:**
  - **Teórico** (km recorridos ÷ `rendimiento_km_lt` de `kaptura_flota`) → se usa para calcular el **margen** de cada servicio. Ya validado como correcto en S-53.
  - **Real** (cartola Copec/Aramco, tabla `kaptura_combustible`) → **no se usa para el margen del servicio** — sirve para ir recalibrando el `rendimiento_km_lt` del equipo en el tiempo. Mecanismo exacto de recalibración: pendiente de definir (¿promedio móvil de cuántas cargas? ¿mensual?).

## 3. Servicios pendientes de confirmar (no cargados aún)

| Empresa | Fecha | Origen→Destino | Patente | Conductor | Cliente | Tarifa | Estado | Servicio |
|---|---|---|---|---|---|---|---|---|
| Global Solutions | 2026-07-02 | Coltauco → Valparaíso | DSDV36 | Felipe Vidal | PRESMITA | $450.000 neto | ejecutado | ✅ Cargado — **S-53** |

*(tabla vacía por ahora — se llena a medida que se procesan más guías paso a paso)*

## 3bis. CASO BASE — Primer servicio de julio (S-53, Felipe Vidal) documentado paso a paso

Este es el caso de referencia completo para mapear la automatización. Cada paso real que ocurrió, con qué tan automatizable es.

| # | Paso real que ocurrió | ¿Quién/qué lo hizo? | ¿Automatizable? | Qué se necesitaría |
|---|---|---|---|---|
| 1 | Chofer termina la ruta y manda foto de la guía + mensaje de texto al grupo WhatsApp "TSBS Spa" | Humano (chofer) | No — es el disparador, siempre será una persona enviando | — |
| 2 | Alguien copia/reenvía esa foto fuera de WhatsApp para poder cargarla | Usuario (manual) | **Sí** — es pura fricción sin valor | whatsapp-web.js leyendo el grupo directo, sin intervención humana |
| 3 | Lectura de los datos impresos del documento (N° guía, fecha, origen) | Claude (visión), ya validado en esta sesión | **Sí, ya probado** | Claude Vision vía n8n, mismo prompt ya usado manualmente en este chat |
| 4 | Lectura del mensaje de texto libre ("desde Coltauco a Valparaíso, término de ruta") para sacar origen/destino/estado | Claude (lectura de contexto) | **Sí, ya probado** | Mismo prompt, pidiendo también interpretar el texto libre del chofer, no solo la foto |
| 5 | Verificar el nombre real del cliente contra Setup (evitar error tipo "Pressetta" vs "Presmita") | Claude, con Supabase conectado | **Sí, ya probado** — falló la primera vez por no consultar, se corrigió al conectar Supabase | Ya resuelto: consulta SQL antes de asumir el nombre |
| 6 | Confirmar/corregir la patente (ilegible en la foto) | Usuario (tuvo que mandar foto de la lista de patentes) | **Parcial** — si la foto es nítida, Claude Vision + cruce contra `kaptura_flota` lo resuelve solo; si es ilegible, siempre requerirá confirmación humana | Cruzar la patente leída contra `kaptura_flota` automáticamente antes de preguntar |
| 7 | Definir la tarifa ($450.000) | Usuario (de memoria, no estaba en ningún documento) | **Parcial** — si existe `tarifario_clientes` (cliente+ruta→tarifa) se autocompleta; si no, sigue siendo dato humano | Construir la tabla `tarifario_clientes` (ya anotado como pendiente en sección 4) |
| 8 | Definir el estado correcto (`ejecutado`, no `cerrado`) | Regla ya fija para Global Solutions (guías llegan al término de ruta) | **Sí, ya es una regla aplicable siempre** | Ninguna — ya es automatizable con la regla de la sección 2 |
| 9 | Armar y presentar el SQL, esperar autorización, insertar en Supabase | Claude + usuario (autoriza) | **Sí, parcialmente ya automatizado** en este chat (Claude arma y ejecuta el SQL) | En producción: n8n insertaría directo en estado "borrador" para revisión, no "ejecutado" directo, para mantener control humano |
| 10 | Los puntos intermedios de la ruta y la asignación completa del servicio | — (no se hizo en este caso, S-53 quedó con `puntos_entrega = 0`) | **No** — no existe esa información en ningún documento ni mensaje | Siempre requiere que el coordinador arme la ruta a mano — límite real de la automatización (ya documentado en sección 4) |

### Conclusión del caso base
De los 10 pasos reales, **6 son automatizables total o parcialmente** (2,3,4,5,6,7,8,9) y **1 es 100% imposible de automatizar** (10, los puntos intermedios) porque el dato no existe en ningún documento — es una decisión humana de planificación diaria. El paso 1 (que llegue la foto) tampoco se automatiza porque es el origen del proceso, no una tarea.

**Esto confirma el diseño ya conversado:** automatizar la captura y el llenado de datos (pasos 2 al 9), pero el resultado debe entrar como servicio en estado **borrador/pendiente de revisión**, nunca completo y cerrado solo — porque el paso 10 (ruta) y la confirmación de patente ilegible siempre necesitan a una persona.

---

## 2duodecies. REGLA — Confirmar explícitamente que se recibieron TODAS las guías (19-07-2026)

**Error real cometido:** se armó S-54 con 2 guías (024086, 024085) asumiendo que era el ciclo completo del servicio. Días después apareció una 3ra guía (N°111, "Desde Chépica con destino Casablanca — Término de ruta") que resultó ser **otro servicio completo** (el regreso con carga de devolución), nunca capturado — se descubrió por casualidad al comparar contra la Rendición de Pablo, no porque el sistema lo haya detectado.

**REGLA FIJA, obligatoria en todo servicio, especialmente multipunto:** después de recibir las guías y antes de cerrar cualquier servicio, Claude debe preguntar explícitamente:

> *"¿Estas son TODAS las guías de este servicio/ciclo, o falta alguna (incluyendo alguna de regreso o devolución)?"*

Esta pregunta debe hacerse **siempre**, no solo cuando algo se ve incompleto — es un checkpoint sistemático, igual que las demás reglas de este documento. Aplica con más fuerza cuando el conductor manda "Término de ruta" — porque un chofer puede mandar varias guías de "término de ruta" separadas en momentos distintos del mismo día/ciclo, cada una correspondiente a un tramo distinto (ida, entrega, regreso con devolución), y no todas llegan juntas.

## 2undecies. Regla — Guías adjuntas y disponibles para revisión (19-07-2026)

**Regla:** las guías (fotos/documentos) deben quedar adjuntas **en el orden real de entrega** a cada punto correspondiente (según la lógica de la ruta, no el orden en que llegaron por WhatsApp), y deben quedar **disponibles en el sistema para abrir y revisar** — esto es lo que lee el botón "🖼 Guías" (`verGuias()`) de cada servicio, a través del campo `guias[].img_url` dentro de cada punto en el marcador `|_PUNTOS:` de `notas`.

⚠️ **Distinción importante, error real cometido y corregido:** el **orden del array** (qué tan pronto aparece cada punto en la lista) es independiente de la etiqueta **`tipo:'final'` vs `tipo:'intermedio'`**. `tipo:'final'` determina qué punto aporta la tarifa base al recálculo en vivo del sistema (`tarifa = final?.valor`) — NO tiene que ver con el orden cronológico de entrega. Al reordenar puntos por fecha/hora real, hay que mantener el `tipo` correcto en cada uno, no intercambiarlo junto con la posición.

**Limitación de Supabase Storage — RESUELTA (21-07-2026):** Claude no tiene herramienta para subir archivos directo a Supabase Storage (bucket `kaptura-guias`). **Solución real ya en uso:** usar el repositorio de GitHub como almacenamiento de archivos, aprovechando el `git push` que sí funciona. Carpeta convención: `guias/{servicio_id}/*` para guías de servicios (el chat del proyecto ya lo hace así) y `documentos/{tipo_entidad}/{ENTIDAD}_{tipo_doc}.ext` para documentos de conductores/equipos/empresa. La URL pública resultante (`https://raw.githubusercontent.com/ctg2026/KAPTURA-PILOTO/main/...`) se guarda directo en el campo `url`/`img_url` correspondiente — funciona igual de bien que Supabase Storage para este propósito, sin necesitar ninguna herramienta adicional.

## 2decies. REGLA CRÍTICA — Dónde vive realmente cada dato en `servicios_piloto` (19-07-2026)

**La columna `puntos_asignados` NO es la que lee el informe para mostrar los puntos de entrega.** El informe (`loadPuntosFromDB`) busca un marcador `|_PUNTOS:[...]` **dentro del campo `notas`**, en formato JSON `[{tipo,destino,valor,num_guia,guias}]`. Si no lo encuentra ahí, genera puntos genéricos ("Punto 1", "Punto 2"...) usando el `valor_punto` del tarifario como respaldo — esto fue exactamente el error real cometido en S-54 (apareció "Punto 1" con $60.000 en vez de "PLACILLA").

**Mismo patrón para horarios:** el marcador `|_HORAS:{salida_base,llegada_origen,salida_destino,llegada_base}` también va dentro de `notas`, no en columnas `hora_salida`/`hora_llegada` sueltas (ya documentado, sección 2ter).

**REGLA FIJA — al insertar/cerrar CUALQUIER servicio con más de 1 punto, `notas` debe llevar SIEMPRE ambos marcadores:**
```
notas = "[texto libre de contexto]|_HORAS:{...}|_PUNTOS:[...]"
```
Sin esto, el informe se ve incompleto aunque los demás campos (fecha_termino, tarifa_neta, etc.) estén perfectos — como pasó en S-54, que necesitó 2 rondas de corrección después de cerrado.

**Nota técnica adicional encontrada:** el timeline de GPS del informe usa `.lte('fecha', fechaTerm)`, y `fechaTerm` depende de que `hora_termino` (columna timestamp) esté seteado — si falta, el timeline solo muestra el primer día, aunque `fecha_termino` (la columna date) sí esté correcta. Por eso `hora_inicio` y `hora_termino` (timestamps) son obligatorios, no opcionales, en cualquier servicio multi-día.

## 2nonies. Reglas de tarifa faltante, umbral de descarga, insistencia y numeración (19-07-2026)

- **Umbral de parada para considerar "descarga real": 20 minutos** (bajado de 30 min). Una parada ≥20 min es candidata a ser una entrega real; menos que eso, probablemente es solo una parada de paso.
- **Cuando no existe tarifa exacta para un destino:** usar la tarifa del destino tarifado **más cercano en distancia real** (no el que coincida numéricamente por casualidad con otro). Revisar también las **observaciones al final de la guía** — suelen traer la dirección exacta de entrega (sector/localidad), que ayuda a identificar el destino real con más precisión que el nombre de comuna genérico del mensaje de WhatsApp.
- **Cuando hay más de una parada candidata (≥20 min) en la misma zona:** priorizar por cercanía geográfica real al destino nombrado en la guía, no por duración de la parada ni por coincidencia de tarifa.
- **REGLA DE INSISTENCIA — obligatoria:** si Claude hace una pregunta y el usuario no la responde en su siguiente mensaje (responde otra cosa, o solo parte de lo preguntado), Claude debe **volver a preguntarla** en cada respuesta siguiente hasta que el usuario la responda explícitamente o diga que la olvide/descarte. Nunca dejar caer una pregunta pendiente en silencio.
- **REGLA DE NUMERACIÓN — obligatoria:** cada pregunta que Claude haga debe venir numerada (1, 2, 3...), para que el usuario pueda responder por número ("1 R ...", "2 R ...").
- **REGLA DE CONTEO DE PUNTOS DE ENTREGA:** el número de puntos de un servicio = **el número de guías de despacho recibidas** para ese servicio (cada guía = un punto), NO el número de paradas que muestre el GPS. El GPS se usa para **ubicar** cada punto (dónde y cuándo ocurrió), no para inventar puntos adicionales sin guía asociada. Si el GPS muestra varias paradas ≥20min en la misma ubicación (ej. dos paradas en Placilla seguidas), esas paradas normalmente son **el mismo punto** (ej. espera en fila + descarga), no dos puntos distintos — salvo evidencia clara de lo contrario.

## 2octies. Reglas de auditoría cruzada y cálculo de días con espera (19-07-2026)

**Regla de auditoría cruzada bidireccional — obligatoria al cerrar CUALQUIER servicio:** al cerrar un servicio, Claude debe revisar automáticamente:
1. **El servicio SIGUIENTE de ese mismo equipo** — de dónde arranca confirma dónde terminó el que se está cerrando.
2. **El servicio ANTERIOR de ese mismo equipo** — dónde terminó confirma de dónde arrancó el que se está cerrando.
Esto corrobora los días asignados al servicio recién cerrado con evidencia de ambos lados (antes y después), no solo mirando el propio GPS del servicio en cuestión de forma aislada.

**Regla de revisión permanente de TODAS las fuentes, no solo GPS:** antes de cerrar cualquier servicio, cruzar sistemáticamente contra todas las tablas relevantes, no limitarse a `kaptura_gps_eventos`:
- `kaptura_gps_eventos` — ruta real, horarios, paradas
- `disponibilidad` — estado diario del equipo (en servicio/disponible/mantención), útil para confirmar equipos activos y cliente asignado ese día (una vez que la pantalla realmente esté guardando, tras el fix de RLS del 18-07)
- `kaptura_flota`, `kaptura_conductores`, `kaptura_clientes`, `kaptura_tarifarios`, `kaptura_corredores` — como ya se hace
Esto permite cruzar asignación, cliente, equipo, patente, chofer y fecha desde más de una fuente antes de dar un dato por confirmado.

**Regla de cálculo de días cuando hay espera entre cargar y repartir:** `dias_servicio` = días con actividad real (día de carga + día de reparto), **no el rango completo de calendario**. Los días donde el camión queda parado en base esperando (ej. fin de semana) NO cuentan como día de servicio. Ejemplo real: carga 03-07, espera 04-05 (fin de semana, sin actividad), reparte y vuelve a base 06-07 → `dias_servicio = 2` (no 4).

**Cómo identificar el día de descarga real:** buscar en el GPS la parada de ≥30 minutos en la zona del destino (regla ya fijada) — la hora de esa parada, y si después el camión vuelve a Base o va a otro punto (confirmado con el servicio siguiente), determinan dónde cortar el servicio.

## 2septies. Push directo a GitHub habilitado (19-07-2026)

**Ya no se necesita que el usuario suba archivos manualmente.** Claude tiene acceso de escritura al repositorio `ctg2026/KAPTURA-PILOTO` mediante un Personal Access Token (fine-grained, permiso "Contents: Read and write", generado por el usuario). Con esto, Claude:
1. Clona/actualiza el repo localmente (`git clone`/`git pull`).
2. Copia los archivos corregidos.
3. Hace `git commit` + `git push` directo — sin exponer el token en ningún documento ni en el historial de git (se usa solo en la URL del remote de forma temporal y se remueve después del push).
4. Verifica el push con `curl` contra `raw.githubusercontent.com`.

**El token NO se guarda en ningún documento** (Memoria, Procedimiento, ni ningún archivo) — es una credencial de sesión. Si expira o se necesita en una conversación nueva, hay que pedirle al usuario que genere uno nuevo (mismo proceso: Settings → Developer settings → Fine-grained tokens → repo específico → Contents: Read and write) y lo pegue en el chat.

**Nota del repo:** GitHub avisa que la organización se movió a `CTG2026` (mayúsculas) — la URL en minúsculas (`ctg2026`) sigue funcionando como alias, no es necesario cambiar nada por ahora.

## 2sexies. Regla fija — Lógica de tramos vacíos/cargados de un servicio (19-07-2026)

**Todo servicio tiene, en general, hasta 3 tramos posibles — el agente debe identificarlos y sumarlos así siempre, no solo el primero:**

1. **Base → Origen: VACÍO** (el camión va a buscar la carga; si Base=Origen, este tramo es 0, no "sin dato")
2. **Origen → Destino: CARGADO** (lleva el flete — este es el único tramo que cuenta como "Km Cargado")
3. **Destino → Base (o siguiente servicio asignado): VACÍO** (ya descargó, vuelve o sigue vacío al próximo servicio)

**Km Vacíos totales = tramo 1 + tramo 3** (nunca solo el tramo 1 — error real que se cometió y corrigió el 19-07-2026: el informe solo sumaba Base→Origen e ignoraba el regreso, mostrando 0km vacíos en un servicio que en realidad tuvo 231km de regreso vacío).

**Aplicar esta regla en dos niveles, ambos obligatorios:**
- **En el sistema (código):** el campo "Km Vacíos" del informe debe sumar `km_base_carga + km_retorno`, no mostrar solo uno de los dos. Ya corregido en `flota-produccion.html` y `global-solutions.html` (línea ~4738/4754).
- **En el agente (Claude, al calcular/cargar un servicio por SQL):** siempre calcular y guardar los 3 tramos por separado (`km_base_carga`, `km_carga_destino`, `km_retorno`) usando el GPS reconstruido del Paso 3 del Procedimiento — nunca dejar el tramo de regreso sin calcular solo porque el informe no lo mostraba antes.

## 2quinquies. Regla de autonomía — nunca pedir lo que ya se puede hacer solo (19-07-2026)

**Regla fija, aplica siempre:** antes de pedirle al usuario que revise/confirme algo, Claude primero debe intentar resolverlo por sí mismo con las herramientas disponibles.

Ejemplo real de esta sesión: en vez de preguntar "¿puedes confirmar el estado del deploy en GitHub?", Claude debió (y luego sí lo hizo) usar `curl` directo contra `raw.githubusercontent.com` para verificar el código real desplegado — sin depender del usuario. `raw.githubusercontent.com` está en el dominio permitido para `bash_tool`, así que esto siempre está disponible cuando el usuario dé una URL de GitHub Pages o repo.

**Límite real de esta regla (no es evasión, es una limitación física genuina):** cosas que ocurren únicamente en el navegador/computador del usuario (caché local, extensiones, configuración de su Chrome) **no las puede ejecutar Claude** — ahí sí corresponde dar instrucciones para que el usuario las haga, porque no hay forma de acceder a su máquina. La regla es "resolver todo lo que se pueda desde las herramientas de Claude", no "nunca pedirle nada al usuario".

## 2ter. Reglas de operación y ruta (19-07-2026)

- **Base ≠ Origen siempre.** Base = Coltauco (fija, para todos los clientes). Pero el **Origen depende del cliente**: para Presmita y la mayoría de los clientes, Origen = Base = Coltauco. **Para Sollem, el Origen es Casablanca** (distinto de la base) — esto significa que para servicios de Sollem SÍ debería haber un tramo "Km Vacíos" real (Base Coltauco → Origen Casablanca) antes del tramo cargado.
- **Metodología Km Vacíos / Km Cargado / Km Retorno** (evidencia real de S-53): usar los tramos de GPS reconstruidos en el Paso 3 del Procedimiento. Km Vacíos = tramo Base→Origen (si son distintos, si son el mismo lugar = 0). Km Cargado = tramo Origen→Destino (la ida real). Km Retorno = tramo Destino→Base (el regreso, normalmente vacío salvo evidencia de carga de vuelta).
- **Identificación de checkpoints de horario** (Salida de Base / Llegada Origen / Salida Destino / Llegada a Base): usar `kaptura_geocercas` (zonas por ciudad/comuna con keywords) para matchear las direcciones del GPS contra Base/Origen/Destino de forma sistemática, no adivinando caso por caso. Guardar en el campo `notas` del servicio con el marcador `|_HORAS:{...}` en formato JSON (`salida_base`, `llegada_origen`, `salida_destino`, `llegada_base`) — así es como lo lee el informe, no las columnas `hora_salida`/`hora_llegada`.

## 2quater. Plan de implementación — meta agosto 2026

- **Objetivo del usuario:** tener la automatización máxima implementada durante agosto 2026, usando todo el aprendizaje acumulado en julio (este documento + el Procedimiento).
- **Trigger de inicio — CONFIRMADO, en uso desde el 19-07-2026:** la palabra **`INICIO`**, escrita por el usuario, gatilla el arranque del procedimiento — Claude debe: (1) leer `MEMORIA_TRABAJO_SERVICIOS.md` y `PROCEDIMIENTO_CALCULO_SERVICIOS.md` completos, (2) verificar que Supabase esté conectado (consulta simple `SELECT now()`), (3) confirmar al usuario que el sistema está listo antes de recibir el siguiente documento. Ya usado y probado varias veces en esta sesión.
- **Camino recomendado para no perder contexto entre chats** (tres opciones, de menor a mayor esfuerzo):
  1. Pasar los documentos manualmente en cada chat nuevo (lo que se ha hecho hasta ahora).
  2. **Recomendado como siguiente paso:** crear un Proyecto de Claude.ai con estos documentos como conocimiento del proyecto — cualquier chat nuevo dentro del proyecto ya parte con las reglas cargadas, sin subir nada.
  3. Automatización real con agente vía API (n8n + WhatsApp + Claude Vision, ya diseñado y pausado) — la meta final de agosto, pero solo después de que el procedimiento esté maduro y probado con más casos.
- **Este es un pendiente, no implementado todavía** — el usuario decidirá cuándo pasar de la opción 1 a la 2 y a la 3.

## 3ter. Límite de automatización — servicios que cruzan medianoche (19-07-2026)

**Nunca se podrá automatizar solo:** cuando un camión termina un servicio (ej. regreso de madrugada) y el mismo día arranca un servicio distinto, alguien tiene que decidir manualmente cómo se reparte el día entre ambos servicios (ej. 1,5 día para el primero). El GPS muestra la actividad, pero no puede decidir a qué servicio pertenece cada tramo cuando hay ambigüedad — eso siempre requiere confirmación humana, igual que los puntos intermedios de ruta.

**CASO BASE FINAL — S-53 con todos los datos reales corregidos:**
Ruta real: Coltauco→Valparaíso (02-07, 10:57-20:06) + regreso Valparaíso→Coltauco (03-07, 02:16-05:23) = **484 km totales** (no 253km — el cálculo inicial solo contaba la ida). Duración: **1,5 días** (el camión arrancó otro servicio distinto la tarde del 03-07).

| Ítem | Monto |
|---|---|
| Combustible (484km÷3,5 rend×$1.200) | $165.943 |
| Peajes (corredor C7) | $22.895 |
| Costo Conductor (1,5 día × $33.000) | $49.500 |
| Comisión Conductor (8% ingreso) | $36.000 |
| Costo Fijo (1,5 día × $87.500, 2 equipos activos) | $131.250 |
| Mantención (484km × $25/km) | $12.100 |
| Viático (1,5 día × $12.000) | $18.000 |
| Contingencia (1,5 día × $25.000) | $37.500 |
| **Total Costos** | **$473.188** |
| Ingreso | $450.000 |
| **Margen real** | **−$23.188 (pérdida)** |

**Lección clave:** el primer cálculo (con km solo de ida y 1 día) dio +$252.465 de margen — un error de +$275.653 respecto al resultado real. Nunca cerrar un servicio sin verificar el km REDONDO completo (ida+vuelta) por GPS y sin confirmar cuántos días de trabajo cruza.

## 4. Mapeo hacia automatización — conclusiones acumuladas

### Lo que SÍ se puede automatizar con lo que existe hoy
- **Lectura de datos del documento** (fecha, origen, destino, N° guía) vía Claude Vision — ya validado manualmente en esta sesión con múltiples guías reales.
- **Aplicar reglas fijas por cliente/ruta** cuando existan (como las de Madrid) para autocompletar patente/chofer/tarifa sin preguntar.

### Lo que NO se puede automatizar (limitación real, no técnica)
- **Los puntos intermedios de la ruta** (ej. "hoy pasa por La Reina, después Kennedy, después La Dehesa") no están escritos en ningún documento — existen solo en la planificación del coordinador. Ningún OCR ni IA puede inventarlos. Esto significa que un servicio con múltiples puntos de entrega **siempre requerirá que una persona complete esa parte**, aunque el resto se automatice.

### Ideas de automatización pendientes de construir (con autorización, ninguna implementada aún)
1. **Tabla `tarifario_clientes`** (cliente + ruta + tarifa neta) — para autocompletar la tarifa cuando no venga en el mensaje de WhatsApp. Propuesta por el usuario el 18-07-2026.
2. **Integración WhatsApp → n8n → Claude Vision → Supabase**: diseño ya conversado (whatsapp-web.js self-hosted en equipo propio, sin costo, corriendo junto a n8n en el mismo servidor 24/7). Crearía el servicio en estado `ejecutado`/borrador con los datos que sí trae el documento; el coordinador completaría patente/conductor/puntos intermedios manualmente. **Pausado** para primero mapear el proceso real paso a paso.
3. **Pantalla "Guías por asignar"** en `global-solutions.html` — necesaria para que el coordinador vea y actúe sobre las guías que llegan automatizadas. Sin esta pantalla, los datos quedarían en Supabase sin que nadie los use. Decisión de construirla: pausada.

---

## 5. HALLAZGO CRÍTICO — Por qué la estructura de costos no está completa (18-07-2026)

Este es el hallazgo más importante de toda la memoria, confirmado con evidencia directa de `servicios_piloto` (27 servicios reales cerrados de Global Solutions) y cruzado contra `Memoria_Calculo_y_Supuestos_Mayo_2026.md` (análisis financiero externo, hecho fuera de Kaptura).

**No es un problema de lectura de Claude ni un bug del código.** El código lee correctamente lo que hay guardado en Supabase. El problema tiene 3 capas reales:

1. **Setup (`kaptura_config`) está casi vacío para Global Solutions**: `viatico_dia=$0`, `sueldo_diario=$0`, `costo_fijo_mensual=$0`, `mant_costo` vacío. Confirmado por consulta SQL directa.
2. **Aun en los servicios que sí se cerraron, hay campos que nunca se completan**: de 27 servicios reales `cerrado`, **el 100% tiene `costo_comision_conductor = 0`** (nunca se aplica ninguna comisión, pese a que el código tiene un default de 8%) y **el 100% tiene `viatico = null`** (nunca se completa). En cambio, `costo_fijo_dia` sí varía y se completa a mano por quien cierra cada servicio (no sale de Setup, que está vacío).
3. **La causa de fondo (la más importante):** según el documento `Memoria_Calculo_y_Supuestos_Mayo_2026.md`, en mayo 2026 **solo se cargó el 19% de los servicios reales del mes en Kaptura (10 de 53)**. No es un problema de configuración — es que casi nadie está registrando los servicios reales en el sistema. Un Setup perfecto no arregla esto: el sistema simplemente no se está usando de forma consistente.

**Implicación directa para la automatización:** esto reordena la prioridad de todo lo que hemos mapeado. Antes de automatizar la lectura de guías o el cálculo de costos, el problema más grande y más barato de resolver es **por qué solo se carga ~20% de los servicios reales** — ninguna automatización de costos sirve de algo si el 80% de los servicios ni siquiera existen en el sistema.

**Margen histórico real observado (referencia, no promedio confiable — muestra chica y con negativos):** servicios cerrados de junio muestran márgenes de -$32.340 a +$267.440 sobre ingresos de $216.000-$707.200. Hay servicios con margen negativo real, no son casos aislados.

## 5bis. Bug real encontrado y corregido — tabla `disponibilidad` sin política RLS (18-07-2026)

La tabla `disponibilidad` tenía RLS activado **sin ninguna política definida** — bloqueaba todo acceso de la app (key pública) de forma silenciosa, porque `guardarDisponibilidad()` en el código tiene un `try/catch` que esconde el error (`console.warn`, sin avisar al usuario). Por eso la pantalla se veía bien pero nunca guardaba nada real. **Corregido**: se agregó política `allow_all` igual a la que ya usa `servicios_piloto`. Pendiente que el usuario confirme en la app que ahora sí guarda.

**Setup cargado en `kaptura_config` (Global Solutions):** viatico_dia=12000, comision_conductor=8, costo_fijo_mensual=3500000, modo_costo_fijo=automatico.

**S-53 — estado final:** ingreso $450.000, costos $266.035 (combustible $86.640 + peajes $22.895 + costo fijo $87.500 + sueldo conductor $33.000 + comisión $36.000), margen **$183.965**. Cerrado, con todos los campos que la interfaz realmente lee, y horarios reales de GPS (salida 10:57, llegada 20:06).

## 5ter. CORRECCIÓN — No hay bug de cálculo en el sistema; el problema es la carga por SQL directo (18-07-2026)

Verificado con evidencia (`guardarCostosBorrador()` + `cerrarServicio()`, líneas 4211-4349 de `global-solutions.html`): **el sistema calcula y guarda los costos correctamente cuando el servicio se cierra por la pantalla normal.** No hay ningún bug de código que corregir en el informe ni en el cierre.

**La causa real de las inconsistencias encontradas (incluyendo el propio S-53 al principio):** los servicios cargados por SQL directo (como la mayoría de lo hecho en esta sesión) **se saltan por completo la lógica de cálculo de la app**, porque nunca pasan por esa pantalla. Quedan campos en $0 o totales que no cuadran no porque el sistema calcule mal, sino porque nunca calculó nada para esos casos.

**REGLA FIJA DEL PROCEDIMIENTO — obligatoria para toda carga por SQL:** replicar exactamente esta fórmula al calcular `total_costos` y `margen_servicio` antes de insertar/actualizar un servicio:
```
total_costos = costo_combustible + costo_peajes + costo_conductor + costo_comision_conductor
             + costo_fijo_dia + costo_mantencion + costo_viaticos + costo_contingencia
             + costo_corretaje + costo_adicional + factoring
margen_servicio = ingreso_total − total_costos
```
Nunca insertar un servicio "cerrado" sin calcular todos estos campos con la misma fórmula — si falta un dato real, dejarlo en 0 explícitamente (no null), y anotarlo en `notas` como estimado o pendiente.

## 6. Acceso a Supabase

- **Desde el 18-07-2026, Supabase está conectado como conector en este chat** (proyecto `aqunzrukuruwzwywnurq`, vía MCP). Claude puede correr `SELECT` directo (`Supabase:execute_sql`) para verificar patentes, clientes, config, servicios, etc. **antes de preguntarle al usuario** — ya no hay que pedir capturas de pantalla para esto.
- **Regla nueva obligatoria:** antes de escribir el nombre de un cliente, patente, o cualquier dato que ya debería existir en el Setup del sistema, Claude debe consultarlo primero contra `kaptura_clientes` / `kaptura_flota` / `kaptura_config` con `execute_sql`. Nunca "aproximar" un nombre leyendo el documento de la guía (ej. error real: se escribió "PRESSETTA" leyendo el documento, cuando el cliente estaba registrado como **"PRESMITA"** en Setup — tuvo que corregirse con un UPDATE después de ya haberse cargado el servicio S-53).
- Para cambios que modifican datos (`INSERT`/`UPDATE`/`DELETE`), Claude sigue presentando el SQL y esperando autorización antes de ejecutarlo (ahora puede ejecutarlo él mismo con `execute_sql` una vez autorizado, no hace falta que el usuario lo pegue en el SQL Editor).

## 7. Pendientes de UI sin resolver

- **Tabla de Servicios se ve cortada horizontalmente en Global Solutions** (con ventana maximizada), algo que no ocurriría en Madrid según el usuario. Se revisó todo el CSS/JS de la tabla (`.desk-tbl`, `overflow-x`, `min-width:1200px`, render de columnas) y es **código idéntico** en ambos archivos — no se encontró causa en el código. Sospecha: zoom del navegador guardado distinto por sitio (Chrome lo guarda por dominio/archivo). Pendiente de confirmar con el usuario revisando el % de zoom real.
- **El informe de servicio (y cualquier otra vista) no debe mostrar la línea "Corretaje/Generador" para Global Solutions, en ninguna parte.** Confirmado que ese modelo de comisión de corretaje no existe para ninguno de los 4 clientes de Global Solutions (Sollem, Presmita, Citrus Agro, Los Montes — los 4 con 0% en `comision_generador_pct`). Mostrar la fila igual (aunque sea en $0) genera confusión — hay que ocultarla condicionalmente para esta empresa. Pendiente de autorización para tocar el código de `informeServicio()` y equivalentes.

---

## 8. Bugs / pendientes técnicos ya identificados en el sistema (sin resolver aún)

- `servicios_piloto` no tiene ningún campo que marque "ya incluido en una liquidación" — por eso servicios de meses ya liquidados (ej. junio) siguen apareciendo como disponibles al crear una liquidación nueva. Requiere agregar un campo de estado/referencia — no implementado.
- Los 3 lugares donde se ordenó por fecha (creación de liquidación, vista de detalle, impresión/PDF) ya fueron corregidos en `flota-produccion.html` y `global-solutions.html` (18-07-2026).
- La función de impresión/PDF de liquidación (`liqImprimir`) no existía en `global-solutions.html` — fue creada desde cero, replicando la de `flota-produccion.html`, con datos de empresa tomados de `DB.config` (vacíos si no están configurados en Setup, nunca con texto fijo inventado).

---

## 9. ADENDA — Nuevo workstream: Presupuesto y Conciliación Bancaria (25-07-2026)

Se creó un documento hermano dedicado, **`MEMORIA_PRESUPUESTO_Y_CONCILIACION.md`**, para el trabajo de Presupuesto/Flujo de Caja/Conciliación Bancaria de Global Solutions (Sollem + TRAST) — no se mezcló con esta memoria porque cubre un proceso distinto (financiero/contable, no carga de servicios). Aun así, algunos hallazgos cruzan directo con lo que ya sabíamos aquí:

- **Confirmado: Sollem se factoriza el 100% de sus facturas** (ya se sospechaba en la sección 5 de este documento) — factoring 3% sobre tarifa bruta.
- **Módulo de factoring de Kaptura (`kaptura_cuentas_por_cobrar`) está gravemente subregistrado** — mismo patrón que ya documentamos para `servicios_piloto` en la sección 5: de ~$11,7M en depósitos de factoring reales identificados en la cartola de junio-julio, solo había 1 registro cargado (19% de cobertura).
- **Servicios multipunto de Sollem generan km adicional real** (~120km por punto adicional, evidencia de 2 casos) — detalle completo y su impacto en `PROCEDIMIENTO_CALCULO_SERVICIOS.md` (adenda) y en `MEMORIA_PRESUPUESTO_Y_CONCILIACION.md`.

---

*Última actualización: 25-07-2026. Este documento debe actualizarse cada vez que se acuerde una regla nueva, se resuelva un pendiente, o se identifique una nueva conclusión de automatización.*
