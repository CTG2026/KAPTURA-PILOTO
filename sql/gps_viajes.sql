-- Tabla de viajes y paradas GPS (Forguard) para Kaptura. Ejecutar una vez en Supabase → SQL Editor.
create table if not exists public.gps_viajes (
  id text primary key,
  empresa text,
  unit_id bigint,
  patente text,
  tipo text,              -- 'viaje' o 'parada'
  inicio timestamptz,
  fin timestamptz,
  en_curso boolean,
  duracion_s integer,
  km numeric,
  vel_max numeric,
  vel_prom numeric,
  lat_ini double precision, lon_ini double precision,
  lat_fin double precision, lon_fin double precision,
  ruta text,
  actualizado timestamptz default now()
);
create index if not exists gps_viajes_patente_inicio on public.gps_viajes (patente, inicio);
alter table public.gps_viajes enable row level security;
drop policy if exists gps_viajes_leer on public.gps_viajes;
drop policy if exists gps_viajes_insertar on public.gps_viajes;
drop policy if exists gps_viajes_actualizar on public.gps_viajes;
create policy gps_viajes_leer on public.gps_viajes for select using (true);
create policy gps_viajes_insertar on public.gps_viajes for insert with check (true);
create policy gps_viajes_actualizar on public.gps_viajes for update using (true) with check (true);
grant select, insert, update on public.gps_viajes to anon, authenticated;
