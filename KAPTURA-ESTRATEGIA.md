# KAPTURA — ESTRATEGIA Y NOTAS

## VISIÓN DEL PRODUCTO

KAPTURA es una capa de inteligencia operacional para transportistas independientes y flotas pequeñas en Chile. Responde la pregunta: **¿gané o perdí plata en este servicio?**

No compite con TMS empresariales (Samsara, Drivin) — los complementa. Un transportista puede tener cualquier GPS y KAPTURA le dice si está ganando o perdiendo plata.

**No existe nada igual en Chile ni en el mundo para el segmento independiente.**

---

## MÓDULOS Y OBJETIVOS

### KAPTURA GO — Básico
- Para transportista independiente con 1 camión
- Flujo: Inicia → GPS registra → Finaliza → Integra → Ve margen
- Sin guías ni fotos (eso es PRO — enganche para upsell)
- Precio referencial: ~$15.000 CLP/mes por equipo

### KAPTURA PRO — Intermedio
- Para transportista con 1 a 3 camiones
- Incluye GO + guías/fotos, KPIs proceso, $/km, ranking clientes
- Guías como respaldo para cobrar servicios
- Precio referencial: ~$25.000 CLP/mes por equipo

### KAPTURA FLOTA — Premium
- Para empresa con 4+ equipos y coordinador
- Asignación, flota, costos, resultados, informes completos
- Precio referencial: ~$40.000 CLP/mes por equipo

---

## EMPRESAS EN EL SISTEMA

| PIN | Empresa | Descripción |
|---|---|---|
| 0101-0108 | Global Solutions | Empresa real piloto — 4 camiones |
| 0201-0208 | Transportes Madrid | Segunda empresa — en implementación |
| 0000 | NEXUS (Demo) | Empresa demo para mostrar a clientes potenciales |

---

## ESTRATEGIA BLACK GPS (DIEGO)

**Diego = dueño de Black GPS**

**La palanca:** Black GPS tiene +500 empresas activas en Chile y +17.000 dispositivos. Sus clientes ya tienen GPS — KAPTURA les agrega la capa de rentabilidad por servicio.

**Propuesta de valor conjunta:**
- Black GPS aporta: GPS + ubicación + control combustible (sensor) + TAG & Multas + ranking conductores
- KAPTURA aporta: margen real por servicio, costos automáticos, estado de resultados

**Integración natural:**
- Sensor combustible Black GPS → combustible real en KAPTURA automático (hoy es manual)
- TAG & Multas Black GPS → corredores KAPTURA → costo peajes automático
- Ranking conductores Black GPS → KPI rentabilidad por conductor en KAPTURA

**Mensaje upsell dentro de KAPTURA GO:**
> "¿Sabías que con el sensor de combustible Black GPS este dato se carga automáticamente?"

**Para la reunión con Diego:**
1. Demo funcional KAPTURA GO con datos NEXUS
2. Mostrar flujo: GPS cualquier proveedor → KAPTURA calcula margen
3. Argumento: "tus clientes ya tienen el GPS, KAPTURA les dice si están ganando o perdiendo plata"

---

## ALIANZA BLACK GPS + SMARTREPORT

Black GPS tiene alianza con SmartReport. Juntos integran telemetría operacional con inteligencia financiera. KAPTURA puede complementar esta alianza como capa de rentabilidad por servicio para el segmento independiente que SmartReport no atiende.

---

## PENDIENTES TÉCNICOS

### KAPTURA GO Demo
- [ ] Configuración mínima (nombre conductor, patente, rendimiento, costos fijos)
- [ ] Tipografía responsive en celular
- [ ] Mensaje upsell sensor combustible Black GPS

### KAPTURA PRO Demo
- [ ] Definir flujo completo con guías y KPIs
- [ ] Pantallas PRO
- [ ] Cargar servicios S-16, S-29 como referencia

### KAPTURA FLOTA Demo
- [ ] PIN coordinador entra directo a FLOTA sin error
- [ ] Dashboard KPIs reales del mes
- [ ] Auditar todos los servicios existentes

### Sistema General
- [ ] Integración API GPS agnóstica (no solo Forguard)
- [ ] Integración API SmartReport
- [ ] Integración proveedores combustible
- [ ] Columna fecha_termino en CF (pendiente fix completo)
- [ ] Corredores Molina — nuevo destino
- [ ] Transportes Madrid — flota por crear

---

## NOTAS DE NEGOCIO

- El producto se construyó porque el dueño lo necesitaba para sí mismo (founder-market fit)
- Ya hay un segundo cliente interesado antes de salir a vender
- El modelo de venta se da solo: primer servicio → el conductor ve que perdía plata → vende solo
- Segmento objetivo: 120.000+ camiones de carga registrados en Chile, mayoría independientes
