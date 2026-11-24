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
    const tok = j && (j.token || j.tk || j.mensaje?.token || j.mensaje?.tk || (typeof j.mensaje === 'string' ? j.mensaje : ''));
    intentos.push({ modo, status: r.status, claves_respuesta: j ? Object.keys(j) : null, texto: j ? undefined : t.slice(0, 200), token_recibido: !!tok });
    if (r.ok && tok) { tk = tok; break; }
  }
  if (!tk) return R({ ok: false, intentos });
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
