// Lee el GPS de R5 (plataforma Wialon) y guarda viajes y paradas en Supabase (tabla gps_viajes),
// con el mismo formato que el proceso de Forguard, para que Kaptura los muestre igual.
// Corre en GitHub Actions cada 30 minutos. No imprime datos sensibles. (Carlos 22-11-2026)
const TOKEN = process.env.R5_WIALON_TOKEN;
const SUPA_URL = process.env.SUPA_URL;
const SUPA_KEY = process.env.SUPA_KEY;
const DIAS = Number(process.env.DIAS || 3); // días hacia atrás en cada lectura
const EMPRESA = process.env.EMPRESA || 'transportes_madrid';
const API = 'https://hst-api.wialon.us/wialon/ajax.html';
const PARADA_MIN = 5 * 60;   // una parada es estar 5 minutos o más sin moverse
const VEL_PARADA = 3;        // km/h: bajo esto se considera detenido

async function call(svc, params, sid) {
  const body = new URLSearchParams({ params: JSON.stringify(params) });
  if (sid) body.append('sid', sid);
  const r = await fetch(API + '?svc=' + svc, { method: 'POST', body });
  const j = await r.json().catch(() => ({}));
  if (j && j.error) throw new Error('Wialon ' + svc + ': error ' + j.error);
  return j;
}

const iso = s => (s ? new Date(s * 1000).toISOString() : null);
const pat = n => String(n || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function km(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLa = rad(b.y - a.y), dLo = rad(b.x - a.x);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a.y)) * Math.cos(rad(b.y)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Agrupa los mensajes en tramos "parada" (sin moverse ≥ 5 min) y "viaje" (lo que hay entre paradas)
export function aFilas(msgs, unit, ahora = Date.now() / 1000, desde = 0) {
  const M = msgs.filter(m => m.pos && m.t).sort((a, b) => a.t - b.t);
  const filas = [];
  if (!M.length) return filas;
  const quieto = m => (m.pos.s || 0) <= VEL_PARADA;
  // tramos crudos de quieto / en movimiento
  const T = [];
  for (const m of M) {
    const q = quieto(m), u = T[T.length - 1];
    if (u && u.q === q) u.m.push(m); else T.push({ q, m: [m] });
  }
  // una "quietud" corta (< 5 min) se suma al viaje
  const S = [];
  for (const t of T) {
    const dur = t.m[t.m.length - 1].t - t.m[0].t;
    const esPar = t.q && dur >= PARADA_MIN;
    const u = S[S.length - 1];
    if (!esPar && u && !u.par) u.m.push(...t.m);
    else if (esPar && u && u.par) u.m.push(...t.m);
    else S.push({ par: esPar, m: [...t.m] });
  }
  // un "viaje" de menos de 300 m es ruido del GPS: se junta con las paradas vecinas
  const dist = g => { let d = 0; for (let k = 1; k < g.m.length; k++) d += km(g.m[k - 1].pos, g.m[k].pos); return d; };
  S.forEach(g => { if (!g.par && dist(g) < 0.3) g.par = true; });
  for (let i = S.length - 1; i > 0; i--) if (S[i].par && S[i - 1].par) { S[i - 1].m.push(...S[i].m); S.splice(i, 1); }
  const P = pat(unit.nm);
  S.forEach((g, i) => {
    const a = g.m[0], z = g.m[g.m.length - 1], sig = S[i + 1];
    const fin = sig ? sig.m[0].t : z.t;
    const enCurso = !sig && ahora - z.t < 15 * 60;
    let dk = 0, vmax = 0;
    for (let k = 1; k < g.m.length; k++) { dk += km(g.m[k - 1].pos, g.m[k].pos); vmax = Math.max(vmax, g.m[k].pos.s || 0); }
    const dur = Math.max(0, fin - a.t);
    filas.push({
      id: 'r5-' + unit.id + '-' + (g.par ? 'stop' : 'trip') + '-' + a.t,
      empresa: EMPRESA,
      unit_id: unit.id,
      patente: P,
      tipo: g.par ? 'parada' : 'viaje',
      inicio: iso(a.t),
      fin: enCurso ? null : iso(fin),
      en_curso: enCurso,
      duracion_s: Math.round(dur),
      km: g.par ? null : Math.round(dk * 1000) / 1000,
      vel_max: g.par ? null : vmax,
      vel_prom: g.par || !dur ? null : Math.round((dk / (dur / 3600)) * 10) / 10,
      lat_ini: a.pos.y, lon_ini: a.pos.x,
      lat_fin: z.pos.y, lon_fin: z.pos.x,
      ruta: null,
      actualizado: new Date().toISOString()
    });
  });
  // el primer tramo queda cortado por el inicio de la ventana de lectura: no se guarda para no duplicar
  if (desde && filas.length && new Date(filas[0].inicio).getTime() / 1000 - desde < 600) filas.shift();
  return filas;
}

async function guardar(filas) {
  for (let i = 0; i < filas.length; i += 500) {
    const r = await fetch(SUPA_URL + '/rest/v1/gps_viajes?on_conflict=id', {
      method: 'POST',
      headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(filas.slice(i, i + 500))
    });
    if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 300));
  }
}

async function main() {
  if (!TOKEN) { console.log('Falta el secreto R5_WIALON_TOKEN: no se hace nada.'); return; }
  const lg = await call('token/login', { token: TOKEN, fl: 1 });
  const sid = lg.eid;
  try {
    const u = await call('core/search_items', { spec: { itemsType: 'avl_unit', propName: 'sys_name', propValueMask: '*', sortType: 'sys_name' }, force: 1, flags: 1, from: 0, to: 0 }, sid);
    const unidades = u.items || [];
    const fin = Math.floor(Date.now() / 1000), ini = fin - DIAS * 86400;
    let todas = [];
    for (const un of unidades) {
      const m = await call('messages/load_interval', { itemId: un.id, timeFrom: ini, timeTo: fin, flags: 1, flagsMask: 65281, loadCount: 0xffffffff }, sid);
      todas = todas.concat(aFilas(m.messages || [], un, Date.now() / 1000, ini));
      await call('messages/unload', {}, sid).catch(() => {});
    }
    await guardar(todas);
    const v = todas.filter(f => f.tipo === 'viaje');
    console.log(`OK: ${unidades.length} unidad(es), ${v.length} viajes y ${todas.length - v.length} paradas de los últimos ${DIAS} días guardados.`);
  } finally {
    await call('core/logout', {}, sid).catch(() => {});
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
}
