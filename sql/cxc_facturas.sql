-- Cuentas por cobrar de Kaptura: facturas por emitir y emitidas (Carlos 01-11-2026).
-- Ejecutar una vez en Supabase → SQL Editor. Los datos se cargan aparte (no van en este repo).
create table if not exists public.cxc_facturas (
  id text primary key,                 -- cliente + período, ej. 'EBLOOMS-2026-10-16'
  empresa text not null default 'transportes_madrid',
  cliente text not null,
  periodo_desde date,
  periodo_hasta date,
  debe_emitir date,                    -- fecha en que corresponde facturar
  folio integer,                       -- null = por emitir
  fecha_emision date,
  neto numeric,
  total numeric,                       -- con IVA
  vence date,                          -- null = se calcula con la regla del cliente
  fecha_cobro date,                    -- null = por cobrar
  cuenta_cobro text,                   -- 'Santander' u otra cuenta
  nota text,
  actualizado timestamptz default now()
);
create index if not exists cxc_facturas_empresa on public.cxc_facturas (empresa, fecha_cobro);
alter table public.cxc_facturas enable row level security;
drop policy if exists cxc_leer on public.cxc_facturas;
drop policy if exists cxc_insertar on public.cxc_facturas;
drop policy if exists cxc_actualizar on public.cxc_facturas;
create policy cxc_leer on public.cxc_facturas for select using (true);
create policy cxc_insertar on public.cxc_facturas for insert with check (true);
create policy cxc_actualizar on public.cxc_facturas for update using (true) with check (true);
grant select, insert, update on public.cxc_facturas to anon, authenticated;
-- 02-11-2026: flujo por aprobar → por facturar → por cobrar → cobrada
alter table public.cxc_facturas add column if not exists etapa text, add column if not exists aprobada date;
