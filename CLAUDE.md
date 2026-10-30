# Instrucciones para Claude – Kaptura y Sistema TM

**Antes de trabajar, lee el contexto completo** (reglas, cambios hechos, protocolos y pendientes):
con el conector Supabase, proyecto `aqunzrukuruwzwywnurq`:

```sql
select contenido, actualizado from public.claude_contexto where id = 'reglas_tm_kaptura';
```

(La tabla es privada: no se publica aquí porque este repo y GitHub Pages son públicos.)
Si haces cambios relevantes, actualiza ese registro (con autorización de Carlos).

## Reglas básicas
- Antes de modificar cualquier archivo, SQL o código: leer lo exacto, explicar qué cambias y qué NO, y esperar "OK" / "Autoriza". "Comenta" = solo comentar. Un cambio a la vez.
- Cero afirmaciones sin evidencia; nunca suponer datos, preguntar.
- No tocar claves, tokens ni secretos (GitHub Secrets / Supabase Vault).
- Respuestas breves, en español.
- No escribir montos, deudas ni datos sensibles en archivos de este repo.

## Kaptura (este repo)
- App: `registro-tm.html` (archivo único HTML+JS). GitHub Pages publica al hacer push a `main`.
- Revisar sintaxis (`node --check` del script) antes de subir; probar con `registro-tm.html?v=N` y pedir captura.
- Datos en Supabase: `servicios_piloto`, `entregas`, `gps_viajes`, `combustible_cargas`.

## Sistema TM (Excel)
- Archivo oficial y protocolo de edición: ver `claude_contexto` en Supabase. No abrir otros archivos de la carpeta sin autorización.
