create extension if not exists pgcrypto;

create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  city text not null,
  website text,
  phone text,
  whatsapp text,
  google_rating numeric(2,1),
  reviews integer default 0,
  has_website boolean default false,
  has_whatsapp_visible boolean default false,
  sector_high_value boolean default false,
  opportunity_score integer default 0 check (opportunity_score between 0 and 100),
  status text not null default 'NEW',
  main_problem text,
  sales_opportunity text,
  suggested_headline text,
  suggested_services jsonb default '[]'::jsonb,
  personalized_message text,
  source text,
  source_url text,
  last_contact timestamptz,
  next_followup timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospects_status_idx on prospects(status);
create index if not exists prospects_score_idx on prospects(opportunity_score desc);
create index if not exists prospects_next_followup_idx on prospects(next_followup);
