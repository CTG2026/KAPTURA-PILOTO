// Bermann GPS → Global Solutions. PASO 1: prueba de solo lectura (Carlos 23-11-2026).
// Inicia sesión con los secretos BERMANN_USER / BERMANN_PASS, lista los camiones y devuelve un resumen.
// No guarda nada y no devuelve el token.
import { crypto } from 'jsr:@std/crypto@1';
import { encodeHex } from 'jsr:@std/encoding@1/hex';

const BASE = 'https://rest2.bermanngps.cl/BermannRest/api/';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
const md5 = async (s: string) => encodeHex(await crypto.subtle.digest('MD5', new TextEncoder().encode(s)));

Deno.serve(async (req) => {
  const R = (o: unknown, status = 200) => new Response(JSON.stringify(o, null, 1), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return R('ok');
  const user = (Deno.env.get('BERMANN_USER') || '').trim(), pass = (Deno.env.get('BERMANN_PASS') || '').trim();
  if (!user || !pass) return R({ error: 'Faltan secretos BERMANN_USER / BERMANN_PASS' });
  const intentos: any[] = [];
  let tk = '';
  // la clave entregada parece ya estar en md5 (32 hex); se prueba tal cual y luego en md5
  for (const [modo, p] of [['clave tal cual', pass], ['clave en md5', await md5(pass)]] as const) {
    const u = BASE + 'login?' + new URLSearchParams({ user, pass: p, app: '2', os: '1' });
    const r = await fetch(u, { headers: { 'Content-Type': 'application/json' } });
    const t = await r.text();
    let j: any = null; try { j = JSON.parse(t); } catch (_) { /* no json */ }
    // forma de la respuesta sin mostrar valores largos (el token no se devuelve)
    const forma = (v: any, d = 0): any => v === null ? null : Array.isArray(v) ? [v.length ? forma(v[0], d + 1) : 'vacío'] : typeof v === 'object' ? (d > 3 ? '{…}' : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, forma(x, d + 1)]))) : typeof v === 'string' ? (v.length > 20 ? 'texto(' + v.length + ')' : v) : v;
    const buscaTk = (v: any): string => { if (!v || typeof v !== 'object') return ''; for (const [k, x] of Object.entries(v)) { if (typeof x === 'string' && x.length > 20 && /^(tk|token|access_?token)$/i.test(k)) return x; const y = buscaTk(x); if (y) return y; } return ''; };
    const tok = j ? (buscaTk(j) || (typeof j.mensaje === 'string' && j.mensaje.length > 20 ? j.mensaje : '')) : '';
    intentos.push({ modo, status: r.status, forma: j ? forma(j) : null, texto: j ? undefined : t.slice(0, 200), token_recibido: !!tok });
    if (r.ok && tok) { tk = tok; break; }
  }
  if (!tk) return R({ ok: false, intentos });
  // PASO 2 (Carlos 23-11): recorrido de un camión entre dos fechas, solo lectura → resumen
  let cuerpo: any = {}; try { cuerpo = await req.json(); } catch (_) { /* sin cuerpo */ }
  if (cuerpo && cuerpo.trayecto) {
    const t = cuerpo.trayecto;
    const rt = await fetch(BASE + 'trayectovehiculorangodl?' + new URLSearchParams({ tk, Avserie: t.av_serie, Fecha: t.fecha, fecha2: t.fecha2 }), { headers: { 'Content-Type': 'application/json' } });
    const tx = await rt.text();
    let jt: any = null; try { jt = JSON.parse(tx); } catch (_) { /* no json */ }
    const P = Array.isArray(jt?.mensaje) ? jt.mensaje : Array.isArray(jt) ? jt : [];
    const odo = P.map((p: any) => +p.odometro).filter((x: number) => x > 0);
    const ev: Record<string, number> = {}; for (const p of P) { const k = p.descripcion_evento || p.evento || String(p.id_tipo_evento ?? '?'); ev[k] = (ev[k] || 0) + 1; }
    return R({ status: rt.status, puntos: P.length, campos: P[0] ? Object.keys(P[0]) : null, primero: P[0] || null, ultimo: P[P.length - 1] || null,
      odometro_min: odo.length ? Math.min(...odo) : null, odometro_max: odo.length ? Math.max(...odo) : null, eventos: ev, texto: P.length ? undefined : tx.slice(0, 400) });
  }
  const r = await fetch(BASE + 'vehiculo?' + new URLSearchParams({ tk, limit: '50', page: '1' }), { headers: { 'Content-Type': 'application/json' } });
  const t = await r.text();
  let j: any = null; try { j = JSON.parse(t); } catch (_) { /* no json */ }
  const lista = Array.isArray(j?.mensaje) ? j.mensaje : Array.isArray(j) ? j : [];
  return R({
    ok: r.ok, intentos, vehiculo_status: r.status, total: lista.length,
    camiones: lista.map((v: any) => ({ patente: v.patente, muestra: v.muestra, av_serie: v.av_serie, fecha: v.fecha, odometro_m: v.odometro, horometro: v.horometro,
      canbus: v.canbus ? { odometro: v.canbus.odometro, litrosquemados: v.canbus.litrosquemados, nivelestanque: v.canbus.nivelestanque, fecha: v.canbus.fechacanbus } : null })),
    texto: lista.length ? undefined : t.slice(0, 300),
  });
});
