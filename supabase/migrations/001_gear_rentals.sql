-- Run this in Supabase Dashboard → SQL Editor
-- Project: wdpouazgxlxgksrjiuhc

create table if not exists gear_rentals (
  id                       uuid primary key default gen_random_uuid(),
  rental_id                text unique not null,
  item_id                  text not null,
  item_name                text not null,
  customer_email           text not null,
  customer_name            text not null,
  start_date               date not null,
  end_date                 date not null,
  days                     integer not null,
  daily_rate_cents         integer not null,
  deposit_cents            integer not null default 2000,
  rental_total_cents       integer not null,
  grand_total_cents        integer not null,
  stripe_session_id        text,
  stripe_payment_intent_id text,
  status                   text not null default 'pending',
  locker_code              text,
  return_photo_urls        text[] not null default '{}',
  return_submitted_at      timestamptz,
  inspection_notes         text,
  deposit_released_at      timestamptz,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

-- After creating the table, also create a Storage bucket:
-- Supabase Dashboard → Storage → New bucket
-- Name: gear-return-photos
-- Public: ON
