-- Tareas diarias del administrador marcadas como hechas en Kaptura (Carlos 02-11-2026). Ejecutar una vez en Supabase → SQL Editor.
create table if not exists public.tareas_admin (
  fecha date not null,
  tarea text not null,
  empresa text not null default 'transportes_madrid',
  hecha_por text,
  hora timestamptz default now(),
  primary key (empresa, fecha, tarea)
);
alter table public.tareas_admin enable row level security;
drop policy if exists tareas_leer on public.tareas_admin;
drop policy if exists tareas_insertar on public.tareas_admin;
create policy tareas_leer on public.tareas_admin for select using (true);
create policy tareas_insertar on public.tareas_admin for insert with check (true);
grant select, insert on public.tareas_admin to anon, authenticated;
