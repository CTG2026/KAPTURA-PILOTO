-- Tareas creadas por administración (únicas, semanales o mensuales), por empresa (Carlos 02-11-2026). Ejecutar una vez en Supabase → SQL Editor.
create table if not exists public.tareas (
  id bigint generated always as identity primary key,
  empresa text not null default 'transportes_madrid',   -- 'transportes_madrid' o 'global_solutions'
  titulo text not null,
  recurrencia text not null default 'unica',             -- 'unica', 'semanal' o 'mensual'
  dias int[],                                            -- semanal: días de la semana (1=lunes … 7=domingo)
  dia_mes int,                                           -- mensual: día del mes
  fecha_limite date,
  activa boolean not null default true,
  creada timestamptz default now(),
  creada_por text
);
alter table public.tareas enable row level security;
drop policy if exists tareas_l on public.tareas;
drop policy if exists tareas_i on public.tareas;
drop policy if exists tareas_u on public.tareas;
create policy tareas_l on public.tareas for select using (true);
create policy tareas_i on public.tareas for insert with check (true);
create policy tareas_u on public.tareas for update using (true) with check (true);
grant select, insert, update on public.tareas to anon, authenticated;
