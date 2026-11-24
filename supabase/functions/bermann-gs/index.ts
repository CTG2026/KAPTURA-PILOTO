// Bermann GPS → gps_odometro de Global Solutions (Carlos 23-11-2026).
// Cada 30 min (cron bermann_gs_lectura): inicia sesión con los secretos BERMANN_USER / BERMANN_PASS (clave tal cual),
// lista los camiones (/vehiculo) y trae el recorrido de cada uno (/trayectovehiculorangodl) de las últimas `horas`
// (por defecto 2; máx. 72). Guarda cada punto como odómetro en km (la API lo entrega en metros), igual que el Excel de Bermann.
// No duplica: índice único (patente, ts). No devuelve el token.
const BASE = 'https://rest2.bermanngps.cl/BermannRest/api/', EMPRESA = 'global_solutions';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function claveNueva(v: string) { try { const o = JSON.parse(Deno.env.get(v) || '{}'); return o.default || Object.values(o)[0] || ''; } catch (_) { return ''; } }
const pad = (n: number) => String(n).padStart(2, '0');
// fecha local de Chile (UTC-3) en formato 'yyyy-mm-dd hh:mi' que pide Bermann
const local = (d: Date) => { const x = new Date(d.getTime() - 3 * 3600000); return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()) + ' ' + pad(x.getUTCHours()) + ':' + pad(x.getUTCMinutes()); };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const getJ = async (url: string) => { const r = await fetch(url, { headers: { 'Content-Type': 'application/json' } }); const t = await r.text(); try { return { ok: r.ok, status: r.status, j: JSON.parse(t) }; } catch (_) { return { ok: false, status: r.status, j: null, t: t.slice(0, 200) }; } };

Deno.serve(async (req) => {
  const R = (b: string, status = 200) => new Response(b, { status, headers: CORS });
  if (req.method === 'OPTIONS') return R('ok');
  const user = (Deno.env.get('BERMANN_USER') || '').trim(), pass = (Deno.env.get('BERMANN_PASS') || '').trim();
  if (!user || !pass) return R('Faltan secretos BERMANN_USER / BERMANN_PASS');
  let horas = 2;
  try { const b = await req.json(); if (b && +b.horas > 0 && +b.horas <= 72) horas = +b.horas; } catch (_) { /* sin cuerpo */ }
  const SUPA = Deno.env.get('SUPABASE_URL')!, KEY = claveNueva('SUPABASE_SECRET_KEYS') || claveNueva('SUPABASE_PUBLISHABLE_KEYS');
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  try {
    const lg = await getJ(BASE + 'login?' + new URLSearchParams({ user, pass, app: '2', os: '1' }));
    const tk = lg.j?.mensaje?.[0]?.token || '';
    if (!tk) throw new Error('login Bermann ' + lg.status + ' sin token');
    await espera(600);
    const vh = await getJ(BASE + 'vehiculo?' + new URLSearchParams({ tk, limit: '50', page: '1' }));
    const camiones = (Array.isArray(vh.j?.mensaje) ? vh.j.mensaje : []).filter((v: any) => v.av_serie && v.patente);
    if (!camiones.length) throw new Error('vehiculo ' + vh.status + ': sin camiones');
    const fin = new Date(), ini = new Date(Date.now() - horas * 3600000);
    let total = 0; const det: string[] = [];
    for (const c of camiones) {
      await espera(600); // límite Bermann: máx. 2 consultas por segundo
      const pat = String(c.patente).replace(/[\s-]/g, '').toUpperCase();
      const tr = await getJ(BASE + 'trayectovehiculorangodl?' + new URLSearchParams({ tk, avserie: String(c.av_serie), fecha: local(ini), fecha2: local(fin) }));
      const P = Array.isArray(tr.j?.mensaje) ? tr.j.mensaje : Array.isArray(tr.j) ? tr.j : [];
      const filas = new Map<string, any>();
      for (const p of P) {
        const m = +p.odometro;
        if (!p.evfecha || !(m > 0)) continue; // el último elemento es la línea del recorrido, sin fecha
        const ts = String(p.evfecha).replace(' ', 'T') + '-03:00';
        filas.set(ts, { empresa: EMPRESA, patente: pat, ts, odometro: Math.round(m / 100) / 10, fuente: 'bermann_api' });
      }
      if (filas.size) {
        const ir = await fetch(SUPA + '/rest/v1/gps_odometro?on_conflict=patente,ts', { method: 'POST', headers: { ...H, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify([...filas.values()]) });
        if (!ir.ok) throw new Error('gps_odometro ' + ir.status + ': ' + (await ir.text()).slice(0, 200));
      }
      total += filas.size; det.push(pat + ' ' + filas.size);
    }
    return R('OK: ' + camiones.length + ' camiones, ' + total + ' puntos (' + local(ini) + ' a ' + local(fin) + ') · ' + det.join(', '));
  } catch (e) {
    return R('ERROR: ' + (e as Error).message, 500);
  }
});
