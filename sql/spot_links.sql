-- Links de un solo uso para que el chofer de un tercero registre un servicio spot sin PIN ni instalar Kaptura (Carlos 02-11-2026).
create table if not exists public.spot_links (
  token text primary key,
  empresa text not null default 'transportes_madrid',
  fecha date, cliente text, servicio text, tarifa_neta numeric,
  tercero text, patente text, pago_tercero numeric,
  creado timestamptz default now(), creado_por text,
  usado timestamptz, servicio_id text
);
alter table public.spot_links enable row level security;
drop policy if exists spot_l on public.spot_links;
drop policy if exists spot_i on public.spot_links;
drop policy if exists spot_u on public.spot_links;
create policy spot_l on public.spot_links for select using (true);
create policy spot_i on public.spot_links for insert with check (true);
create policy spot_u on public.spot_links for update using (true) with check (true);
grant select, insert, update on public.spot_links to anon, authenticated;
