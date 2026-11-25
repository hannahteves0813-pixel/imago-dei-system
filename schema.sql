-- ============================================================
-- IMAGO DEI Patient Intake & Service Record Management System
-- Supabase setup script - run the ENTIRE file once
-- SQL Editor > New query > paste > Run
-- ============================================================

create extension if not exists "uuid-ossp";

-- USER ROLES & PROFILES
create type public.app_role as enum ('admin', 'staff');

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        public.app_role not null default 'staff',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'staff'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin');
$$;

-- CLIENTS
create sequence public.client_code_seq start 1001;

create table public.clients (
  id                       uuid primary key default uuid_generate_v4(),
  client_code              text unique not null
                           default ('IDC-' || nextval('public.client_code_seq')),
  full_name                text not null,
  contact_number           text,
  address                  text,
  date_of_birth            date,
  gender                   text check (gender in ('Female','Male','Other')),
  emergency_contact_person text,
  emergency_contact_number text,
  health_conditions        text,
  allergies                text,
  remarks                  text,
  intake_image_path        text,
  registered_at            date not null default current_date,
  created_by               uuid references public.profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index clients_name_idx on public.clients (lower(full_name));
create unique index clients_no_duplicate_name_contact
  on public.clients (lower(full_name), coalesce(contact_number,''));

-- SERVICE CATALOG
create table public.services (
  id               uuid primary key default uuid_generate_v4(),
  name             text unique not null,
  description      text,
  duration_minutes integer,
  price            numeric(10,2) not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- MIDWIVES
create sequence public.midwife_code_seq start 101;

create table public.midwives (
  id             uuid primary key default uuid_generate_v4(),
  midwife_code   text unique not null
                 default ('IDM-' || nextval('public.midwife_code_seq')),
  full_name      text not null,
  contact_number text,
  status         text not null default 'Active'
                 check (status in ('Active','Inactive')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.midwife_specializations (
  midwife_id uuid not null references public.midwives(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (midwife_id, service_id)
);

-- SERVICE RECORDS
create table public.service_records (
  id               uuid primary key default uuid_generate_v4(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  service_id       uuid not null references public.services(id),
  service_date     date not null default current_date,
  description      text,
  duration_minutes integer,
  price            numeric(10,2) not null default 0,
  payment_status   text not null default 'Unpaid'
                   check (payment_status in ('Paid','Unpaid','Partial')),
  feedback         text,
  notes            text,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index service_records_client_idx
  on public.service_records (client_id, service_date desc);

create table public.service_record_midwives (
  service_record_id uuid not null references public.service_records(id) on delete cascade,
  midwife_id        uuid not null references public.midwives(id),
  primary key (service_record_id, midwife_id)
);

-- updated_at auto-timestamps
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_clients_updated before update on public.clients
  for each row execute function public.touch_updated_at();
create trigger trg_midwives_updated before update on public.midwives
  for each row execute function public.touch_updated_at();
create trigger trg_sr_updated before update on public.service_records
  for each row execute function public.touch_updated_at();
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.midwives enable row level security;
alter table public.midwife_specializations enable row level security;
alter table public.service_records enable row level security;
alter table public.service_record_midwives enable row level security;

create policy "profiles select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles admin update" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "clients select" on public.clients for select to authenticated using (true);
create policy "clients insert" on public.clients for insert to authenticated with check (true);
create policy "clients update" on public.clients for update to authenticated using (true);
create policy "clients admin delete" on public.clients for delete to authenticated
  using (public.is_admin());

create policy "services select" on public.services for select to authenticated using (true);
create policy "services admin insert" on public.services for insert to authenticated
  with check (public.is_admin());
create policy "services admin update" on public.services for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "services admin delete" on public.services for delete to authenticated
  using (public.is_admin());

create policy "midwives select" on public.midwives for select to authenticated using (true);
create policy "midwives admin insert" on public.midwives for insert to authenticated
  with check (public.is_admin());
create policy "midwives admin update" on public.midwives for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "midwives admin delete" on public.midwives for delete to authenticated
  using (public.is_admin());

create policy "spec select" on public.midwife_specializations for select to authenticated using (true);
create policy "spec admin insert" on public.midwife_specializations for insert to authenticated
  with check (public.is_admin());
create policy "spec admin delete" on public.midwife_specializations for delete to authenticated
  using (public.is_admin());

create policy "sr select" on public.service_records for select to authenticated using (true);
create policy "sr insert" on public.service_records for insert to authenticated with check (true);
create policy "sr update" on public.service_records for update to authenticated using (true);
create policy "sr admin delete" on public.service_records for delete to authenticated
  using (public.is_admin());

create policy "srm select" on public.service_record_midwives for select to authenticated using (true);
create policy "srm insert" on public.service_record_midwives for insert to authenticated with check (true);
create policy "srm admin delete" on public.service_record_midwives for delete to authenticated
  using (public.is_admin());

-- STORAGE BUCKET for intake form images
insert into storage.buckets (id, name, public)
values ('intake-forms', 'intake-forms', false)
on conflict (id) do nothing;

create policy "intake upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'intake-forms');
create policy "intake read" on storage.objects for select to authenticated
  using (bucket_id = 'intake-forms');
create policy "intake admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'intake-forms' and public.is_admin());
