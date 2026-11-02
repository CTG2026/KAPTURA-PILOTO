-- Alertas para Carlos, Claudio y administración en el inicio de Kaptura (Carlos 01-11-2026). Ejecutar una vez en Supabase → SQL Editor.
create table if not exists public.alertas_admin (
  id bigint generated always as identity primary key,
  empresa text not null default 'transportes_madrid',
  titulo text not null,
  detalle text,
  activa boolean not null default true,
  creada timestamptz default now(),
  resuelta timestamptz,
  resuelta_por text,
  resolucion text
);
alter table public.alertas_admin enable row level security;
drop policy if exists alertas_leer on public.alertas_admin;
drop policy if exists alertas_insertar on public.alertas_admin;
drop policy if exists alertas_actualizar on public.alertas_admin;
create policy alertas_leer on public.alertas_admin for select using (true);
create policy alertas_insertar on public.alertas_admin for insert with check (true);
create policy alertas_actualizar on public.alertas_admin for update using (true) with check (true);
grant select, insert, update on public.alertas_admin to anon, authenticated;
-- 02-11-2026: destinatarios ('todos' = administración + coordinador; 'admin' = solo administración)
alter table public.alertas_admin add column if not exists para text not null default 'todos';
