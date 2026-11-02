-- Reportes del sistema TM (pilares por mes y caja de la semana) para Kaptura (Carlos 02-11-2026). Ejecutar una vez en Supabase → SQL Editor.
-- Abierta por ahora (decisión de Carlos 02-11); Claude la alimenta desde el sistema TM.
create table if not exists public.tm_reportes (
  empresa text not null default 'transportes_madrid',
  tipo text not null,            -- 'pilares' (periodo AAAA-MM) o 'caja_semana' (periodo = lunes AAAA-MM-DD)
  periodo text not null,
  datos jsonb not null,
  actualizado timestamptz default now(),
  primary key (empresa, tipo, periodo)
);
alter table public.tm_reportes enable row level security;
drop policy if exists tm_reportes_leer on public.tm_reportes;
create policy tm_reportes_leer on public.tm_reportes for select using (true);
grant select on public.tm_reportes to anon, authenticated;
