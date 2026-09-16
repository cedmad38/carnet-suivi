-- =====================================================================
--  Carnet de suivi — schéma Supabase
--  À coller en une fois dans : Supabase → SQL Editor → New query → Run
--
--  Principe de sécurité :
--   • n'importe qui peut créer un compte, mais NE VOIT RIEN ;
--   • une « demande d'accès » est créée automatiquement ;
--   • seul un administrateur du carnet l'accepte (ou la refuse) ;
--   • les membres voient et écrivent tout le carnet ;
--   • on ne supprime que ses propres notes (l'admin peut tout supprimer).
-- =====================================================================

-- ---------- Membres du carnet ----------
create table if not exists public.members (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role         text not null default 'famille' check (role in ('admin','famille','pro')),
  created_at   timestamptz not null default now()
);

-- ---------- Demandes d'accès (créées à l'inscription) ----------
create table if not exists public.access_requests (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ---------- Notes du carnet ----------
-- kind : day (fiche du jour), episode, sensory (séance sensorielle),
--        change (changement à venir), trial (essai)
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('day','episode','sensory','change','trial')),
  date        date not null,
  data        jsonb not null default '{}'::jsonb,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists entries_date_idx on public.entries (date desc);
-- une seule fiche « jour » par date
create unique index if not exists entries_one_day_idx on public.entries (date) where kind = 'day';

-- ---------- Réglages partagés (listes de signes, activités…) ----------
create table if not exists public.settings (
  key         text primary key,
  data        jsonb not null,
  updated_by  uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at  timestamptz not null default now()
);

-- ---------- Fonctions d'aide (security definer : évite la récursion RLS) ----------
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where user_id = auth.uid();
$$;

-- Horodatage + auteur de la dernière modification
create or replace function public.touch_entry() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before insert or update on public.entries
  for each row execute function public.touch_entry();

-- Demande d'accès automatique à la création d'un compte
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.access_requests (user_id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accepter une demande (admin uniquement)
create or replace function public.approve_request(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.access_requests;
begin
  if not public.is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if p_role not in ('admin','famille','pro') then raise exception 'Rôle inconnu'; end if;
  select * into r from public.access_requests where user_id = p_user;
  if not found then raise exception 'Demande introuvable'; end if;
  insert into public.members (user_id, display_name, role)
  values (r.user_id, coalesce(r.display_name, r.email), p_role)
  on conflict (user_id) do update set role = excluded.role;
  delete from public.access_requests where user_id = p_user;
end $$;

-- ---------- Row Level Security ----------
alter table public.members         enable row level security;
alter table public.access_requests enable row level security;
alter table public.entries         enable row level security;
alter table public.settings        enable row level security;

drop policy if exists members_select on public.members;
create policy members_select on public.members for select using (public.is_member());
drop policy if exists members_update on public.members;
create policy members_update on public.members for update
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or (user_id = auth.uid() and role = public.my_role()));
drop policy if exists members_delete on public.members;
create policy members_delete on public.members for delete
  using (public.is_admin() and user_id <> auth.uid());

drop policy if exists requests_select on public.access_requests;
create policy requests_select on public.access_requests for select
  using (public.is_admin() or user_id = auth.uid());
drop policy if exists requests_delete on public.access_requests;
create policy requests_delete on public.access_requests for delete using (public.is_admin());

drop policy if exists entries_select on public.entries;
create policy entries_select on public.entries for select using (public.is_member());
drop policy if exists entries_insert on public.entries;
create policy entries_insert on public.entries for insert with check (public.is_member());
drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries for update using (public.is_member()) with check (public.is_member());
drop policy if exists entries_delete on public.entries;
create policy entries_delete on public.entries for delete
  using (public.is_admin() or (public.is_member() and created_by = auth.uid()));

drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select using (public.is_member());
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all using (public.is_member()) with check (public.is_member());

-- ---------- Temps réel (les autres voient les ajouts sans recharger) ----------
do $$ begin
  alter publication supabase_realtime add table public.entries;
exception when duplicate_object then null; end $$;

-- =====================================================================
--  PREMIER ADMINISTRATEUR — à lancer UNE FOIS, APRÈS avoir créé ton
--  compte depuis la page du carnet (remplacer l'email si besoin) :
--
--  insert into public.members (user_id, display_name, role)
--  select id, 'Cédric', 'admin' from auth.users where email = 'cedmad@hotmail.com'
--  on conflict (user_id) do update set role = 'admin';
--  delete from public.access_requests
--  where user_id = (select id from auth.users where email = 'cedmad@hotmail.com');
-- =====================================================================
