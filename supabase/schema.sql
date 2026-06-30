-- ═══════════════════════════════════════════════════════════════════════
-- BoxRetreat — Supabase Schema v2
-- Vacation Rental + Shop + Financial Management + Role-Based Access
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────
-- 0. USER ROLES
--    Two roles: 'admin' (owner) and 'client' (guest)
-- ─────────────────────────────────────────────────
create table if not exists user_roles (
    user_id   uuid primary key references auth.users(id) on delete cascade,
    role      text not null default 'client' check (role in ('admin', 'client')),
    created_at timestamptz not null default now()
);

-- Auto-assign 'client' role on new sign-up via trigger
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
    insert into user_roles (user_id, role)
    values (new.id, 'client')
    on conflict (user_id) do nothing;
    return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();

-- Helper: get current user's role
create or replace function get_my_role()
returns text language sql security definer as $$
    select role from user_roles where user_id = auth.uid();
$$;

-- ─────────────────────────────────────────────────
-- 1. RESERVATIONS
-- ─────────────────────────────────────────────────
create table if not exists reservations (
    id                text        primary key,
    status            text        not null default 'confirmed'
                                  check (status in ('confirmed','cancelled','pending')),
    guest_name        text,
    guest_email       text,
    guest_phone       text,
    guest_notes       text,
    guests            int         not null default 1,
    check_in          date        not null,
    check_out         date        not null,
    nights            int         not null,
    price_per_night   numeric(8,2) not null,
    subtotal          numeric(8,2) not null,
    cleaning_fee      numeric(8,2) not null default 75,
    service_fee       numeric(8,2) not null default 0,
    taxes             numeric(8,2) not null default 0,
    total             numeric(8,2) not null,
    stripe_session_id text,
    stripe_payment_id text,
    utm_source        text,
    utm_medium        text,
    utm_campaign      text,
    user_id           uuid references auth.users(id),
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────────
-- 2. PRODUCTS (catalog with sell price + unit cost)
-- ─────────────────────────────────────────────────
create table if not exists products (
    id          text        primary key,
    name        text        not null,
    category    text        not null default 'general',
    sell_price  numeric(8,2) not null,
    cost_price  numeric(8,2) not null default 0,
    margin      numeric(8,2) generated always as (sell_price - cost_price) stored,
    stock       int         not null default 0,
    active      boolean     not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Seed default BoxRetreat products
insert into products (id, name, category, sell_price, cost_price, stock) values
    ('PROD-SHIRT',  'BoxRetreat T-Shirt',    'apparel', 28, 12, 50),
    ('PROD-WAX',    'Surf Wax (3-pack)',      'surf',    15,  5, 30),
    ('PROD-TOTE',   'Beach Tote Bag',         'apparel', 22,  8, 20),
    ('PROD-SNORKEL','Snorkel Set',            'water',   45, 18, 10),
    ('PROD-CAP',    'BoxRetreat Cap',         'apparel', 24,  9, 25),
    ('PROD-BOARD',  'Surfboard (day rental)', 'surf',    35,  5,  3)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────
-- 3. COST ENTRIES (operational + COGS + ad spend)
-- ─────────────────────────────────────────────────
create table if not exists cost_entries (
    id             text        primary key,
    type           text        not null check (type in ('property','product','adspend')),
    date           date        not null,
    description    text,
    amount         numeric(8,2) not null check (amount >= 0),
    -- product-specific
    product_id     text references products(id),
    units          int,
    unit_cost      numeric(8,2),
    -- adspend-specific
    platform       text check (platform in ('meta','google','tiktok','other')),
    campaign       text,
    leads_expected int,
    created_at     timestamptz not null default now()
);

create index if not exists idx_costs_date on cost_entries(date);
create index if not exists idx_costs_type on cost_entries(type);

-- ─────────────────────────────────────────────────
-- 4. LEADS (converted clients — rentals + product sales)
-- ─────────────────────────────────────────────────
create table if not exists leads (
    id              text        primary key,
    type            text        not null check (type in ('rental','product')),
    date            date        not null,
    reservation_id  text references reservations(id),
    guest_name      text,
    guest_email     text,
    revenue         numeric(8,2) not null default 0,
    cost_cpa        numeric(8,2) not null default 0,  -- attributed ad cost
    op_cost         numeric(8,2) not null default 0,  -- operational cost
    cogs            numeric(8,2) not null default 0,  -- cost of goods
    total_cost      numeric(8,2) generated always as (cost_cpa + op_cost + cogs) stored,
    net_profit      numeric(8,2) generated always as (revenue - cost_cpa - op_cost - cogs) stored,
    source          text        check (source in ('meta','google','tiktok','organic','direct')),
    campaign        text,
    user_id         uuid references auth.users(id),
    created_at      timestamptz not null default now()
);

create index if not exists idx_leads_date  on leads(date);
create index if not exists idx_leads_type  on leads(type);
create index if not exists idx_leads_email on leads(guest_email);

-- ─────────────────────────────────────────────────
-- 5. AD SPEND (kept for backward compatibility)
-- ─────────────────────────────────────────────────
create table if not exists ad_spend (
    id          text        primary key,
    period      text        not null,
    platform    text        not null check (platform in ('meta','google','tiktok','other')),
    campaign    text,
    amount      numeric(8,2) not null check (amount > 0),
    created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────
-- 6. BLOCKED DATES & PRICING CONFIG
-- ─────────────────────────────────────────────────
create table if not exists blocked_dates (
    date       date primary key,
    reason     text,
    created_at timestamptz not null default now()
);

create table if not exists pricing_config (
    key        text primary key,
    value      text not null,
    updated_at timestamptz not null default now()
);

insert into pricing_config (key, value) values
    ('price_per_night',  '185'),
    ('cleaning_fee',     '75'),
    ('service_fee_pct',  '14'),
    ('tax_rate',         '0.115'),
    ('daily_op_cost',    '45')
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════
alter table user_roles    enable row level security;
alter table reservations  enable row level security;
alter table products      enable row level security;
alter table cost_entries  enable row level security;
alter table leads         enable row level security;
alter table ad_spend      enable row level security;
alter table blocked_dates enable row level security;
alter table pricing_config enable row level security;

-- Admin: full access to everything
create policy "admin_all_roles"    on user_roles     for all using (get_my_role() = 'admin');
create policy "admin_all_res"      on reservations   for all using (get_my_role() = 'admin');
create policy "admin_all_products" on products       for all using (get_my_role() = 'admin');
create policy "admin_all_costs"    on cost_entries   for all using (get_my_role() = 'admin');
create policy "admin_all_leads"    on leads          for all using (get_my_role() = 'admin');
create policy "admin_all_spend"    on ad_spend       for all using (get_my_role() = 'admin');
create policy "admin_all_blocked"  on blocked_dates  for all using (get_my_role() = 'admin');
create policy "admin_all_pricing"  on pricing_config for all using (get_my_role() = 'admin');

-- Clients: read public products, manage their own reservations
create policy "client_read_products"  on products      for select using (active = true);
create policy "client_own_res_read"   on reservations  for select using (user_id = auth.uid());
create policy "client_own_res_insert" on reservations  for insert with check (user_id = auth.uid());
create policy "client_own_role"       on user_roles    for select using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
-- FINANCIAL REPORT VIEWS
-- ═══════════════════════════════════════════════════════════════════════

-- P&L by period (daily)
create or replace view v_daily_pnl as
select
    coalesce(l.date, c.date)           as date,
    coalesce(sum(l.revenue), 0)        as revenue,
    coalesce(sum(l.op_cost), 0)        as op_cost,
    coalesce(sum(l.cogs), 0)           as cogs,
    coalesce(sum(l.cost_cpa), 0)       as cpa,
    coalesce(sum(c.amount), 0)         as manual_costs,
    coalesce(sum(l.net_profit), 0)
        - coalesce(sum(c.amount), 0)   as net_profit
from leads l
full outer join cost_entries c on l.date = c.date
group by 1
order by 1 desc;

-- Monthly P&L
create or replace view v_monthly_pnl as
select
    to_char(date, 'YYYY-MM')      as period,
    sum(revenue)                  as gross_revenue,
    sum(op_cost)                  as total_op_cost,
    sum(cogs)                     as total_cogs,
    sum(cpa)                      as total_cpa,
    sum(manual_costs)             as total_manual_costs,
    sum(net_profit)               as net_profit,
    case when sum(revenue) > 0
         then round((sum(net_profit) / sum(revenue) * 100)::numeric, 1)
         else 0 end               as margin_pct
from v_daily_pnl
group by 1
order by 1 desc;

-- Lead acquisition by source
create or replace view v_lead_attribution as
select
    source,
    count(*)               as leads,
    sum(revenue)           as revenue,
    sum(cost_cpa)          as ad_spend,
    sum(net_profit)        as net_profit,
    case when count(*) > 0
         then round((sum(cost_cpa) / count(*))::numeric, 2)
         else 0 end        as avg_cpa,
    case when sum(cost_cpa) > 0
         then round(((sum(revenue) - sum(cost_cpa)) / sum(cost_cpa) * 100)::numeric, 1)
         else null end     as roi_pct
from leads
group by source
order by revenue desc;

-- Product profitability
create or replace view v_product_margins as
select
    p.id, p.name, p.category,
    p.sell_price, p.cost_price, p.margin,
    round((p.margin / nullif(p.sell_price, 0) * 100)::numeric, 1) as margin_pct,
    p.stock,
    p.stock * p.cost_price  as inventory_value,
    p.stock * p.sell_price  as potential_revenue
from products p
where p.active = true
order by margin_pct desc;
