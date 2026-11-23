// Avisos de Kaptura por Telegram (bot Kaptura TM) a Carlos y Claudio (Carlos 23-11-2026).
// tipo 'servicio': lo llama un trigger al registrarse un servicio. tipo 'diario': pg_cron a las 21:00 (Chile).
// Destinatarios: quienes tocaron Iniciar en el bot (se guardan en tareas recurrencia='telegram_chats'). No imprime el token.
const URL0 = Deno.env.get('SUPABASE_URL')!;
const EMP = 'transportes_madrid';
function clave(v: string) { try { const o = JSON.parse(Deno.env.get(v) || '{}'); return o.default || Object.values(o)[0] || ''; } catch (_) { return ''; } }
const KEY = clave('SUPABASE_SECRET_KEYS') || clave('SUPABASE_PUBLISHABLE_KEYS');
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const TOK = ((Deno.env.get('TELEGRAM_BOT_TOKEN') || '').match(/\d{6,}:[A-Za-z0-9_-]{20,}/) || [''])[0];
const db = async (q: string) => { const r = await fetch(URL0 + '/rest/v1/' + q, { headers: H }); return r.ok ? await r.json() : []; };
const tg = (m: string, body: unknown) => fetch('https://api.telegram.org/bot' + TOK + '/' + m, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({}));
const fm = (v: number) => '$' + Math.round(v || 0).toLocaleString('es-CL');
const esc = (s: unknown) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
const notas = (n: unknown) => { try { return typeof n === 'string' ? JSON.parse(n) : (n || {}); } catch (_) { return {}; } };

async function chats() {
  const fila = (await db(`tareas?select=id,titulo&empresa=eq.${EMP}&recurrencia=eq.telegram_chats&limit=1`))[0];
  let C: Record<string, string> = {};
  try { C = fila ? JSON.parse(fila.titulo).chats || {} : {}; } catch (_) { C = {}; }
  const u = await tg('getUpdates', {});
  let nuevo = false;
  for (const x of (u.result || [])) { const c = (x.message || x.my_chat_member || {}).chat; if (c && c.type === 'private' && !C[String(c.id)]) { C[String(c.id)] = [c.first_name, c.last_name].filter(Boolean).join(' '); nuevo = true; } }
  if (nuevo) {
    const t = JSON.stringify({ chats: C });
    if (fila) await fetch(URL0 + '/rest/v1/tareas?id=eq.' + fila.id, { method: 'PATCH', headers: H, body: JSON.stringify({ titulo: t }) });
    else await fetch(URL0 + '/rest/v1/tareas', { method: 'POST', headers: H, body: JSON.stringify({ empresa: EMP, titulo: t, recurrencia: 'telegram_chats', activa: true, creada_por: 'Kaptura' }) });
  }
  return C;
}
async function enviar(txt: string, solo?: string) {
  const C = await chats();
  const ids = solo ? Object.keys(C).filter((k) => C[k].includes(solo)) : Object.keys(C);
  for (const id of ids) await tg('sendMessage', { chat_id: id, text: txt, parse_mode: 'HTML', disable_web_page_preview: true });
  return ids.length;
}
function hoyCL() { return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); }

Deno.serve(async (req) => {
  if (!TOK) return new Response('Falta TELEGRAM_BOT_TOKEN');
  let b: any = {}; try { b = await req.json(); } catch (_) { /* */ }
  if (b.tipo === 'servicio' && b.id) {
    await new Promise((r) => setTimeout(r, 4000)); // deja que se complete el registro (código, entregas)
    const s = (await db(`servicios_piloto?select=*&servicio_id=eq.${encodeURIComponent(b.id)}`))[0];
    if (!s || s.empresa !== EMP || s.modo !== 'registro_tm') return new Response('sin servicio');
    const n = notas(s.notas), ex = n.extras || {}, ac = ex.acoplado_reemplazo || n.acoplado || '';
    const E = (n.entregas || []).map((e: any) => '· ' + esc(e.hora || '') + ' ' + esc(e.local || e.obs || ''));
    const txt = `✅ <b>Servicio ${esc(n.codigo || '')} registrado</b>\n${esc(s.conductor)} · ${esc(s.patente)}${ac ? ' + ' + esc(ac) : ' (sin acoplado)'}\n${esc(s.cliente || '')} · ${esc(String(n.servicio_sistema || '').replace(/^[^:]*:\s*/, ''))}${s.tarifa_neta ? ' · ' + fm(+s.tarifa_neta) + ' neto' : ''}` + (E.length ? `\n${E.length} entrega(s):\n${E.join('\n')}` : '');
    return new Response('enviado a ' + (await enviar(txt)));
  }
  if (b.tipo === 'diario' || b.tipo === 'prueba') {
    const f = b.fecha || hoyCL();
    const S = await db(`servicios_piloto?select=conductor,cliente,tarifa_neta,notas&empresa=eq.${EMP}&modo=eq.registro_tm&estado=neq.anulado&fecha=eq.${f}`);
    const Ent = await db(`entregas?select=conductor,local&empresa=eq.${EMP}&fecha=eq.${f}&estado=neq.prueba&servicio_id=is.null`);
    const venta = S.reduce((a: number, x: any) => a + (+x.tarifa_neta || 0), 0);
    const porC: Record<string, number> = {}; S.forEach((x: any) => { porC[x.cliente || 'Sin cliente'] = (porC[x.cliente || 'Sin cliente'] || 0) + 1; });
    const sinR: Record<string, number> = {}; Ent.forEach((e: any) => { if (!S.some((x: any) => x.conductor === e.conductor)) sinR[e.conductor] = (sinR[e.conductor] || 0) + 1; });
    const txt = (b.tipo === 'prueba' ? '🧪 <b>Prueba del bot Kaptura TM</b>\n' : '') + `📋 <b>Resumen del día ${f.split('-').reverse().join('-')}</b>\n${S.length} servicio(s) · venta neta ${fm(venta)}` +
      (Object.keys(porC).length ? '\n' + Object.entries(porC).map(([c, k]) => `· ${esc(c)}: ${k}`).join('\n') : '') +
      (Object.keys(sinR).length ? '\n⚠ <b>Entregas sin servicio registrado</b>:\n' + Object.entries(sinR).map(([c, k]) => `· ${esc(c)} (${k} entrega(s))`).join('\n') : '\n✔ Todos los choferes con entregas registraron su servicio.');
    return new Response('enviado a ' + (await enviar(txt, b.tipo === 'prueba' ? 'Carlos' : undefined)));
  }
  return new Response('tipo no válido');
});
