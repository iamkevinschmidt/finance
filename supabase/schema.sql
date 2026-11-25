-- Finanzen Fam. Schmidt – Tabellen im Supabase-Projekt "Trainingsplan" (Präfix fin_)
-- Zugriff nur für Personen in fin_mitglieder; schreiben nur mit Rolle admin.

create table if not exists public.fin_mitglieder (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  rolle text not null default 'lesen' check (rolle in ('admin','lesen'))
);

create or replace function public.fin_ist_mitglied() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.fin_mitglieder where user_id = auth.uid()) $$;

create or replace function public.fin_ist_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.fin_mitglieder where user_id = auth.uid() and rolle = 'admin') $$;

revoke execute on function public.fin_ist_mitglied() from anon;
revoke execute on function public.fin_ist_admin() from anon;

create table if not exists public.fin_konten (
  id bigint generated always as identity primary key,
  name text not null,
  art text not null check (art in ('giro','tagesgeld','depot','kredit','sonstiges')),
  saldo numeric(12,2) not null default 0,
  stand date not null default current_date,
  zins numeric(6,3),            -- % p. a. (Kredit oder Tagesgeld)
  rate numeric(10,2),           -- Monatsrate beim Kredit
  zaehlt_als_notgroschen boolean not null default false,
  notiz text,
  sort int not null default 0
);

create table if not exists public.fin_posten (
  id bigint generated always as identity primary key,
  kategorie text not null,
  name text not null,
  typ text not null check (typ in ('einnahme','ausgabe','sparen')),
  betrag numeric(10,2) not null default 0,   -- geplant pro Monat
  ziel numeric(10,2),                        -- Budgetziel pro Monat (optional)
  fix boolean not null default false,        -- vertraglich/fest
  aktiv boolean not null default true,
  notiz text,
  sort int not null default 0
);

create table if not exists public.fin_buchungen (
  id bigint generated always as identity primary key,
  schluessel text not null unique,
  datum date not null,
  konto text not null,
  empfaenger text,
  zweck text,
  betrag numeric(12,2) not null,
  kategorie text not null,
  manuell boolean not null default false,
  importiert_am timestamptz not null default now()
);
create index if not exists fin_buchungen_datum on public.fin_buchungen (datum desc);

create table if not exists public.fin_ziele (
  id bigint generated always as identity primary key,
  name text not null,
  zielbetrag numeric(12,2),
  zieldatum date,
  status text not null default 'offen' check (status in ('offen','aktiv','erreicht')),
  notiz text,
  sort int not null default 0
);

create table if not exists public.fin_massnahmen (
  id bigint generated always as identity primary key,
  titel text not null,
  monat text,                 -- 'YYYY-MM' oder null
  status text not null default 'offen' check (status in ('offen','erledigt')),
  wirkung numeric(10,2),      -- € pro Monat (+ spart / bringt)
  notiz text,
  erstellt timestamptz not null default now()
);

create table if not exists public.fin_szenarien (
  id bigint generated always as identity primary key,
  name text not null,
  werte jsonb not null,
  erstellt timestamptz not null default now()
);

create table if not exists public.fin_einstellungen (
  schluessel text primary key,
  wert jsonb
);

do $$
declare t text;
begin
  foreach t in array array['fin_mitglieder','fin_konten','fin_posten','fin_buchungen','fin_ziele','fin_massnahmen','fin_szenarien','fin_einstellungen'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_lesen', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.fin_ist_mitglied())', t || '_lesen', t);
    if t <> 'fin_mitglieder' then
      execute format('drop policy if exists %I on public.%I', t || '_schreiben', t);
      execute format('create policy %I on public.%I for all to authenticated using (public.fin_ist_admin()) with check (public.fin_ist_admin())', t || '_schreiben', t);
    end if;
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
