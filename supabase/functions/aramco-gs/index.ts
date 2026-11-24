// Aramco (Esmax) → combustible_cargas de Global Solutions (copia de aramco-tm, Carlos 23-11-2026).
// Lee el WebService SOAP de Esmax (RetornarTransaccionesConsolidadas, máx. 30 días) con la clave del secreto ARAMCO_GS_CLAVE
// y guarda cada carga nueva. No duplica: salta las que ya existen por documento (API-<IDTransaccion>) o por patente + fecha + litros
// (cargas subidas antes por Excel). El odómetro queda en la nota ("odómetro N km") para el rendimiento.
const RUT_GS = '78.303.134-5', EMPRESA = 'global_solutions';
const WS = 'https://www.portaltarjetas.cl/wstransaccionesflota/wstransaccionesflota.asmx';

function claveNueva(v: string) { try { const o = JSON.parse(Deno.env.get(v) || '{}'); return o.default || Object.values(o)[0] || ''; } catch (_) { return ''; } }
const tag = (x: string, t: string) => { const m = x.match(new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>')); return m ? m[1].trim() : ''; };
const num = (s: string) => +(s || '0').replace(',', '.') || 0;
const iso = (d: Date) => d.toISOString().slice(0, 10);

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
Deno.serve(async (req) => {
  // todas las respuestas llevan CORS (botón "Actualizar Aramco" de Kaptura, Carlos 23-11)
  const Response2 = (b: string, o: any = {}) => new Response(b, { ...o, headers: { ...CORS, ...(o.headers || {}) } });
  if (req.method === 'OPTIONS') return Response2('ok');
  const CLAVE = (Deno.env.get('ARAMCO_GS_CLAVE') || '').trim();
  if (!CLAVE) return Response2('Falta el secreto ARAMCO_GS_CLAVE', { status: 200 });
  let dias = 3;
  try { const b = await req.json(); if (b && +b.dias > 0 && +b.dias <= 30) dias = +b.dias; } catch (_) { /* sin cuerpo */ }
  const SUPA = Deno.env.get('SUPABASE_URL')!, KEY = claveNueva('SUPABASE_SECRET_KEYS') || claveNueva('SUPABASE_PUBLISHABLE_KEYS');
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  try {
    const fin = new Date(), ini = new Date(Date.now() - (dias - 1) * 86400000);
    const body = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>'
      + '<RetornarTransaccionesConsolidadas xmlns="http://petrobrasflota.cl/"><credenciales><RUT>' + RUT_GS + '</RUT><Senha>' + CLAVE + '</Senha></credenciales>'
      + '<dataInicial>' + iso(ini) + '</dataInicial><dataFinal>' + iso(fin) + '</dataFinal></RetornarTransaccionesConsolidadas></soap:Body></soap:Envelope>';
    const r = await fetch(WS, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://petrobrasflota.cl/RetornarTransaccionesConsolidadas"' }, body });
    const x = await r.text();
    if (!r.ok) throw new Error('Esmax ' + r.status + ': ' + x.slice(0, 300));
    const errs = tag(tag(x, 'ListaErrores'), 'string') || tag(x, 'Mensaje');
    const T = x.split('<TransacoesExportacao>').slice(1).map((s) => s.split('</TransacoesExportacao>')[0]);
    if (!T.length) return Response2('OK: 0 transacciones (' + iso(ini) + ' a ' + iso(fin) + ')' + (errs ? ' · aviso Esmax: ' + errs : ''));
    // existentes para no duplicar
    const ex = await fetch(SUPA + '/rest/v1/combustible_cargas?select=id,documento,patente,fecha,litros,nota&empresa=eq.' + EMPRESA + '&fuente=eq.aramco&fecha=gte.' + iso(new Date(ini.getTime() - 86400000)), { headers: H }).then((r) => r.json());
    const docs = new Set((ex || []).map((e: any) => e.documento)), clave = (p: string, f: string, l: number) => p + '|' + f + '|' + l.toFixed(1);
    const yaPFL = new Map((ex || []).map((e: any) => [clave(String(e.patente || '').replace(/[\s-]/g, ''), e.fecha, +e.litros), e]));
    let odoAgregados = 0;
    const nuevas: any[] = [];
    for (const t of T) {
      const id = tag(t, 'IDTransaccion'), doc = 'API-' + id, f = tag(t, 'Fecha'), fecha = f.slice(0, 10), pat = tag(t, 'Patente').replace(/[\s-]/g, '').toUpperCase(), lit = num(tag(t, 'Volumen'));
      const odo = num(tag(t, 'Odometro')), previa: any = yaPFL.get(clave(pat, fecha, lit));
      // carga ya subida por Excel: solo se le agrega el odómetro de la API a la nota (para el rendimiento)
      if (previa && odo > 0 && !/od[oó]metro/i.test(previa.nota || '')) { const pr = await fetch(SUPA + '/rest/v1/combustible_cargas?id=eq.' + previa.id, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ nota: (previa.nota ? previa.nota + ' · ' : '') + 'API Esmax · odómetro ' + Math.round(odo) + ' km' }) }); if (pr.ok) odoAgregados++; }
      if (!id || docs.has(doc) || previa) continue;
      nuevas.push({ empresa: EMPRESA, fuente: 'aramco', documento: doc, fecha, ts: f ? f + '-03:00' : null, patente: pat, litros: lit, total: num(tag(t, 'TotalPago')), iva: num(tag(t, 'IVA')),
        nota: 'API Esmax · ' + tag(t, 'EstacionServicio') + ' (' + tag(t, 'Comuna') + ') · pizarra $' + tag(t, 'Pizarra') + ' · descuento $' + tag(t, 'TotalDescuento') + ' · factura ' + tag(t, 'Factura') + ' · guía ' + tag(t, 'GuiaDespacho') + (odo > 0 ? ' · odómetro ' + Math.round(odo) + ' km' : '') + (tag(t, 'RUTChofer') ? ' · chofer ' + tag(t, 'RUTChofer') : '') });
    }
    if (!nuevas.length) return Response2('OK: ' + T.length + ' transacciones, 0 nuevas, odómetro agregado a ' + odoAgregados);
    const lr = await fetch(SUPA + '/rest/v1/cargas_lote', { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ empresa: EMPRESA, tipo: 'aramco', archivo: 'API Esmax ' + iso(fin), filas: nuevas.length, resumen: {}, creado_por: 'API Esmax (automático)' }) });
    if (!lr.ok) throw new Error('Lote ' + lr.status + ': ' + (await lr.text()).slice(0, 300));
    const lote = (await lr.json())[0].id;
    const ir = await fetch(SUPA + '/rest/v1/combustible_cargas', { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(nuevas.map((n) => ({ ...n, lote_id: lote }))) });
    if (!ir.ok) throw new Error('Cargas ' + ir.status + ': ' + (await ir.text()).slice(0, 300));
    return Response2('OK: ' + T.length + ' transacciones, ' + nuevas.length + ' nuevas guardadas, odómetro agregado a ' + odoAgregados);
  } catch (e) {
    return Response2('ERROR: ' + (e as Error).message, { status: 500 });
  }
});
