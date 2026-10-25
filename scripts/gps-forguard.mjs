// Lee viajes y paradas de los GPS de Forguard (GPS-Trace) y los guarda en Supabase (tabla gps_viajes).
// Corre en GitHub Actions cada 30 minutos. No imprime datos sensibles. (v2)
const TOKEN = process.env.FORGUARD_TOKEN;
const SUPA_URL = process.env.SUPA_URL;
const SUPA_KEY = process.env.SUPA_KEY;
const DIAS = Number(process.env.DIAS || 3); // días hacia atrás en cada lectura
const EMPRESA = process.env.EMPRESA || 'transportes_madrid';


async function rpc(method, params) {
  const r = await fetch('https://forguard.gurtam.space/api/platform', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-AccessToken': TOKEN },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 'k' })
  });
  const j = await r.json().catch(() => ({}));
  if (j.error) throw new Error('Forguard ' + method + ': ' + (j.error.message || 'error') + ' ' + JSON.stringify(j.error.data || '').slice(0, 200));
  return j.result;
}

const iso = s => (s ? new Date(s * 1000).toISOString() : null);

export function aFilas(eventos, unidades) {
  const pat = Object.fromEntries(unidades.map(u => [String(u.id), u.name]));
  return eventos.filter(e => e.type === 'trip' || e.type === 'stop').map(e => ({
    id: e.unit_id + '-' + e.type + '-' + e.begin,
    empresa: EMPRESA,
    unit_id: e.unit_id,
    patente: pat[String(e.unit_id)] || e.unit_name || null,
    tipo: e.type === 'trip' ? 'viaje' : 'parada',
    inicio: iso(e.begin),
    fin: iso(e.end),
    en_curso: !!e.active,
    duracion_s: e.duration != null ? Math.round(e.duration) : null,
    km: e.type === 'trip' && e.mileage != null ? Math.round(e.mileage * 1000) / 1000 : null,
    vel_max: e.speed_max ?? null,
    vel_prom: e.speed_average != null ? Math.round(e.speed_average * 10) / 10 : null,
    lat_ini: e.lat ?? null, lon_ini: e.lon ?? null,
    lat_fin: e.lat_last ?? e.lat ?? null, lon_fin: e.lon_last ?? e.lon ?? null,
    ruta: e.route || null,
    actualizado: new Date().toISOString()
  }));
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
  if (!TOKEN) { console.log('Falta el secreto FORGUARD_TOKEN: no se hace nada.'); return; }
  const unidades = await rpc('units.get', {});
  const fin = Math.floor(Date.now() / 1000), ini = fin - DIAS * 86400;
  const eventos = await rpc('units.events.trips_stops.get', { unit_ids: unidades.map(u => String(u.id)), begin: ini, end: fin, events: ['trip', 'stop'] });
  const filas = aFilas(eventos || [], unidades);
  await guardar(filas);
  const v = filas.filter(f => f.tipo === 'viaje');
  console.log(`OK: ${unidades.length} unidad(es), ${v.length} viajes y ${filas.length - v.length} paradas de los últimos ${DIAS} días guardados.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
}
