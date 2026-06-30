-- Storage bucket for ID photos (public so Telegram can display them)
insert into storage.buckets (id, name, public)
values ('id-photos', 'id-photos', true)
on conflict do nothing;

-- Lockers table
create table if not exists lockers (
  id            uuid primary key default gen_random_uuid(),
  item_id       text not null,
  locker_number integer not null,
  access_code   text not null,
  description   text,
  is_active     boolean not null default true,
  created_at    timestamptz default now(),
  unique(item_id, locker_number)
);

-- Seed lockers
insert into lockers (item_id, locker_number, access_code, description) values
  ('surfboard', 1, '4821', 'Blue locker #1'),
  ('surfboard', 2, '3947', 'Blue locker #2'),
  ('surfboard', 3, '7203', 'Blue locker #3'),
  ('kayak',     1, '5512', 'Green locker #1'),
  ('kayak',     2, '8834', 'Green locker #2'),
  ('snorkel',   1, '2291', 'Yellow locker #1'),
  ('snorkel',   2, '6673', 'Yellow locker #2'),
  ('gopro',     1, '1456', 'Orange locker #1'),
  ('bike',      1, '9908', 'Red locker #1'),
  ('bike',      2, '3321', 'Red locker #2'),
  ('beach-set', 1, '7745', 'White locker #1')
on conflict do nothing;

-- New fields on gear_rentals
alter table gear_rentals add column if not exists id_type text;
alter table gear_rentals add column if not exists id_number text;
alter table gear_rentals add column if not exists id_photo_url text;
alter table gear_rentals add column if not exists locker_id uuid references lockers(id);
alter table gear_rentals add column if not exists locker_access_code text;
alter table gear_rentals add column if not exists validation_status text not null default 'pending_payment';
alter table gear_rentals add column if not exists telegram_message_id bigint;
alter table gear_rentals add column if not exists return_deadline timestamptz;
alter table gear_rentals add column if not exists confirmation_sent_at timestamptz;
alter table gear_rentals add column if not exists reminder_sent_at timestamptz;

-- Extensions table
create table if not exists gear_rental_extensions (
  id                       uuid primary key default gen_random_uuid(),
  rental_id                text not null references gear_rentals(rental_id),
  extension_days           integer not null,
  daily_rate_cents         integer not null,
  discount_amount_cents    integer not null default 0,
  total_cents              integer not null,
  stripe_session_id        text,
  stripe_payment_intent_id text,
  paid_at                  timestamptz,
  created_at               timestamptz default now()
);
