-- =============================================================
-- 12 — Table des outfits (ensembles complets)
-- À exécuter dans Supabase → SQL Editor. Idempotent.
--
-- Un outfit = un ensemble de produits existants vendus ensemble,
-- avec un prix global (manuel ou remise %).
-- =============================================================

create table if not exists public.outfits (
  id text primary key,
  name text not null,
  description text,
  image_url text,
  -- ids des produits (table products) séparés par des virgules
  product_ids text not null default '',
  -- prix global manuel (prioritaire) ; null = prix calculé
  price_eur numeric,
  -- remise automatique en % appliquée à la somme des pièces
  discount_pct numeric,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.outfits enable row level security;

drop policy if exists "outfits_public_read"  on public.outfits;
drop policy if exists "outfits_admin_write"  on public.outfits;
drop policy if exists "outfits_admin_update" on public.outfits;
drop policy if exists "outfits_admin_delete" on public.outfits;

create policy "outfits_public_read"
  on public.outfits for select
  using (true);

create policy "outfits_admin_write"
  on public.outfits for insert
  to authenticated with check (true);

create policy "outfits_admin_update"
  on public.outfits for update
  to authenticated using (true) with check (true);

create policy "outfits_admin_delete"
  on public.outfits for delete
  to authenticated using (true);
