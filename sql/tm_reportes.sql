-- Reportes del sistema TM (pilares por mes y caja de la semana) para Kaptura (Carlos 02-11-2026). Ejecutar una vez en Supabase → SQL Editor.
-- La tabla queda cerrada: solo se lee con la función tm_reporte, que pide un PIN de administración.
create table if not exists public.tm_reportes (
  empresa text not null default 'transportes_madrid',
  tipo text not null,            -- 'pilares' (periodo AAAA-MM) o 'caja_semana' (periodo = lunes AAAA-MM-DD)
  periodo text not null,
  datos jsonb not null,
  actualizado timestamptz default now(),
  primary key (empresa, tipo, periodo)
);
alter table public.tm_reportes enable row level security;
revoke all on public.tm_reportes from anon, authenticated;
create table if not exists public.kaptura_pin_admin (pin_hash text primary key, nombre text);
alter table public.kaptura_pin_admin enable row level security;
revoke all on public.kaptura_pin_admin from anon, authenticated;
create or replace function public.tm_reporte(p_pin text, p_tipo text, p_periodo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from kaptura_pin_admin where pin_hash = encode(extensions.digest(p_pin,'sha256'),'hex')) then
    raise exception 'PIN no autorizado';
  end if;
  if p_periodo is null then
    return (select coalesce(jsonb_agg(jsonb_build_object('periodo',periodo,'actualizado',actualizado) order by periodo desc),'[]'::jsonb) from tm_reportes where tipo=p_tipo);
  end if;
  return (select jsonb_build_object('datos',datos,'actualizado',actualizado) from tm_reportes where tipo=p_tipo and periodo=p_periodo);
end $$;
grant execute on function public.tm_reporte(text,text,text) to anon, authenticated;
