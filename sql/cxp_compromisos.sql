-- Compromisos fijos de pago (CxP) para Kaptura administración (Carlos 02-11-2026). Fuente: maestro de compromisos y costos fijos del sistema TM.
create table if not exists public.cxp_compromisos (
  id text primary key,                 -- ej. 'CF-GPS-2026-11', 'COM-130'
  empresa text not null default 'transportes_madrid',
  fecha date not null,                 -- fecha de pago comprometida
  acreedor text, concepto text, categoria text,
  monto numeric,
  estado text not null default 'pendiente',   -- 'pendiente' o 'pagado'
  fecha_pago date, cuenta text, nota text,
  actualizado timestamptz default now()
);
alter table public.cxp_compromisos enable row level security;
drop policy if exists cxp_l on public.cxp_compromisos;
drop policy if exists cxp_i on public.cxp_compromisos;
drop policy if exists cxp_u on public.cxp_compromisos;
create policy cxp_l on public.cxp_compromisos for select using (true);
create policy cxp_i on public.cxp_compromisos for insert with check (true);
create policy cxp_u on public.cxp_compromisos for update using (true) with check (true);
grant select, insert, update on public.cxp_compromisos to anon, authenticated;
