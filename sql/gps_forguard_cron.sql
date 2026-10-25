-- Lectura automática del GPS Forguard dentro de Supabase (cada 30 min), sin depender de GitHub ni del PC.
-- Requiere el secreto 'forguard_token' en Vault (lo crea Carlos; ver al final).
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.gps_forguard_config (
  id int primary key default 1,
  unit_ids text[] not null default array['7418370'],
  dias int not null default 3
);
insert into public.gps_forguard_config (id) values (1) on conflict do nothing;

create table if not exists public.gps_forguard_pedidos (
  request_id bigint primary key,
  creado timestamptz default now(),
  procesado timestamptz,
  estado text,          -- 'ok', 'error'
  detalle text
);
alter table public.gps_forguard_config enable row level security;
alter table public.gps_forguard_pedidos enable row level security;
drop policy if exists gps_pedidos_leer on public.gps_forguard_pedidos;
create policy gps_pedidos_leer on public.gps_forguard_pedidos for select using (true);
grant select on public.gps_forguard_pedidos to anon, authenticated;

-- 1) Procesa las respuestas ya recibidas y guarda viajes/paradas en gps_viajes
create or replace function public.gps_forguard_procesar() returns void
language plpgsql security definer set search_path = public, net as $$
declare p record; r record; j jsonb; n int;
begin
  for p in select * from public.gps_forguard_pedidos where procesado is null order by creado loop
    select * into r from net._http_response where id = p.request_id;
    if not found then
      if p.creado < now() - interval '30 minutes' then
        update public.gps_forguard_pedidos set procesado = now(), estado = 'error', detalle = 'sin respuesta' where request_id = p.request_id;
      end if;
      continue;
    end if;
    begin
      j := r.content::jsonb;
    exception when others then j := null; end;
    if r.status_code is distinct from 200 or j is null or j ? 'error' then
      update public.gps_forguard_pedidos set procesado = now(), estado = 'error',
        detalle = left(coalesce(r.error_msg, (j->'error')::text, r.content, 'error'), 500) where request_id = p.request_id;
      continue;
    end if;
    insert into public.gps_viajes (id, empresa, unit_id, patente, tipo, inicio, fin, en_curso, duracion_s, km, vel_max, vel_prom, lat_ini, lon_ini, lat_fin, lon_fin, ruta, actualizado)
    select (e->>'unit_id') || '-' || (e->>'type') || '-' || (e->>'begin'),
           'transportes_madrid', (e->>'unit_id')::bigint, e->>'unit_name',
           case e->>'type' when 'trip' then 'viaje' else 'parada' end,
           to_timestamp((e->>'begin')::double precision),
           case when e->>'end' is null then null else to_timestamp((e->>'end')::double precision) end,
           coalesce((e->>'active')::boolean, false),
           round((e->>'duration')::numeric)::int,
           case when e->>'type' = 'trip' then round((e->>'mileage')::numeric, 3) end,
           (e->>'speed_max')::numeric, round((e->>'speed_average')::numeric, 1),
           (e->>'lat')::float8, (e->>'lon')::float8,
           coalesce(e->>'lat_last', e->>'lat')::float8, coalesce(e->>'lon_last', e->>'lon')::float8,
           e->>'route', now()
    from jsonb_array_elements(coalesce(j->'result', '[]'::jsonb)) e
    where e->>'type' in ('trip', 'stop')
    on conflict (id) do update set fin = excluded.fin, en_curso = excluded.en_curso, duracion_s = excluded.duracion_s,
      km = excluded.km, vel_max = excluded.vel_max, vel_prom = excluded.vel_prom, lat_fin = excluded.lat_fin,
      lon_fin = excluded.lon_fin, ruta = excluded.ruta, actualizado = now();
    get diagnostics n = row_count;
    update public.gps_forguard_pedidos set procesado = now(), estado = 'ok', detalle = n || ' filas' where request_id = p.request_id;
  end loop;
  delete from public.gps_forguard_pedidos where creado < now() - interval '7 days';
end $$;

-- 2) Pide a Forguard los viajes y paradas de los últimos días
create or replace function public.gps_forguard_pedir() returns bigint
language plpgsql security definer set search_path = public, net, vault as $$
declare tok text; cfg record; rid bigint;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'forguard_token' limit 1;
  if tok is null then raise exception 'Falta el secreto forguard_token en Vault'; end if;
  select * into cfg from public.gps_forguard_config where id = 1;
  select net.http_post(
    url := 'https://forguard.gurtam.space/api/platform',
    body := jsonb_build_object('jsonrpc', '2.0', 'id', 'k', 'method', 'units.events.trips_stops.get',
      'params', jsonb_build_object('unit_ids', to_jsonb(cfg.unit_ids),
        'begin', floor(extract(epoch from now()) - cfg.dias * 86400)::bigint,
        'end', floor(extract(epoch from now()))::bigint,
        'events', jsonb_build_array('trip', 'stop'))),
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-AccessToken', tok),
    timeout_milliseconds := 30000
  ) into rid;
  insert into public.gps_forguard_pedidos (request_id) values (rid);
  return rid;
end $$;

-- 3) Un paso: procesa lo pendiente y pide lo nuevo
create or replace function public.gps_forguard_ciclo() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.gps_forguard_procesar();
  perform public.gps_forguard_pedir();
end $$;

revoke all on function public.gps_forguard_procesar(), public.gps_forguard_pedir(), public.gps_forguard_ciclo() from public, anon, authenticated;

-- Programación: pide en los minutos 7 y 37; procesa 3 minutos después
select cron.unschedule(jobid) from cron.job where jobname in ('gps_forguard_ciclo', 'gps_forguard_procesar');
select cron.schedule('gps_forguard_ciclo', '7,37 * * * *', 'select public.gps_forguard_ciclo()');
select cron.schedule('gps_forguard_procesar', '10,40 * * * *', 'select public.gps_forguard_procesar()');

-- Secreto (lo ejecuta Carlos, reemplazando PEGAR_LLAVE_AQUI por la llave de Forguard):
-- select vault.create_secret('PEGAR_LLAVE_AQUI', 'forguard_token');
-- Para cambiarla después:
-- select vault.update_secret((select id from vault.secrets where name = 'forguard_token'), 'LLAVE_NUEVA');
