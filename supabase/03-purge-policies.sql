-- ============================================================================
--  tof-shop — Purge des anciennes policies + remise en place propre
-- ============================================================================
--  POURQUOI CE SCRIPT
--  ------------------
--  Le script 01 supprimait les policies par leur nom. Mais ta base contenait
--  déjà des policies créées avant (via l'interface Supabase, avec des noms
--  du type "Enable read access for all users"). Elles n'ont donc pas été
--  supprimées — et une seule policy permissive suffit à tout ouvrir.
--
--  Vérifié : orders, notes et chat_messages renvoyaient encore les données
--  en clair APRÈS le script 01.
--
--  Ce script-ci supprime TOUTES les policies des tables concernées, quel que
--  soit leur nom, puis recrée uniquement les bonnes.
--
--  À exécuter dans Supabase → SQL Editor → New query → Run.
--  Idempotent : relançable sans risque.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PURGE — on efface toutes les policies existantes des tables sensibles
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'orders', 'notes', 'chat_messages', 'promo_codes',
        'products', 'settings', 'featured_drop'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );
    raise notice 'Policy supprimée : %.% → %',
      pol.schemaname, pol.tablename, pol.policyname;
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS activé partout (au cas où une table aurait été oubliée)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'orders', 'notes', 'chat_messages', 'promo_codes',
    'products', 'settings', 'featured_drop'
  ]
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
      -- NB : surtout PAS de "force row level security" ici. Cela appliquerait
      -- le RLS au propriétaire de la table, donc aussi aux fonctions
      -- "security definer" (track_order, recent_orders_public...) qui
      -- s'exécutent en tant que propriétaire — le suivi de commande et la
      -- preuve sociale renverraient alors du vide.
      execute format('alter table public.%I no force row level security', t);
    end if;
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PRODUITS — vitrine : lecture publique, écriture admin
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read"
  on public.products for select
  to anon, authenticated using (true);

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write"
  on public.products for insert
  to authenticated with check (true);

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update"
  on public.products for update
  to authenticated using (true) with check (true);

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete"
  on public.products for delete
  to authenticated using (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. COMMANDES — le client peut commander, personne ne peut lire
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert"
  on public.orders for insert
  to anon, authenticated with check (true);

drop policy if exists "orders_admin_read" on public.orders;
create policy "orders_admin_read"
  on public.orders for select
  to authenticated using (true);

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update"
  on public.orders for update
  to authenticated using (true) with check (true);

drop policy if exists "orders_admin_delete" on public.orders;
create policy "orders_admin_delete"
  on public.orders for delete
  to authenticated using (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RÉGLAGES + DROP — lecture publique, écriture admin
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "settings_public_read" on public.settings;
create policy "settings_public_read"
  on public.settings for select
  to anon, authenticated using (true);

drop policy if exists "settings_admin_write" on public.settings;
create policy "settings_admin_write"
  on public.settings for all
  to authenticated using (true) with check (true);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'featured_drop'
  ) then
    execute 'drop policy if exists "drop_public_read" on public.featured_drop';
    execute 'drop policy if exists "drop_admin_write" on public.featured_drop';
    execute 'create policy "drop_public_read"
      on public.featured_drop for select
      to anon, authenticated using (true)';
    execute 'create policy "drop_admin_write"
      on public.featured_drop for all
      to authenticated using (true) with check (true)';
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CODES PROMO — aucun accès direct (validation par fonction uniquement)
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "promo_admin_all" on public.promo_codes;
create policy "promo_admin_all"
  on public.promo_codes for all
  to authenticated using (true) with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CHAT — le visiteur écrit, mais ne lit que via get_conversation()
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "chat_public_insert" on public.chat_messages;
create policy "chat_public_insert"
  on public.chat_messages for insert
  to anon, authenticated with check (true);

drop policy if exists "chat_admin_all" on public.chat_messages;
create policy "chat_admin_all"
  on public.chat_messages for all
  to authenticated using (true) with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. NOTES — strictement privé
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "notes_admin_all" on public.notes;
create policy "notes_admin_all"
  on public.notes for all
  to authenticated using (true) with check (true);


-- ============================================================================
--  VÉRIFICATION — exécute cette requête après le Run.
--  Chaque table sensible ne doit avoir QUE les policies listées ci-dessus,
--  et aucune ligne avec roles = {public}.
-- ============================================================================
select
  tablename,
  policyname,
  cmd,
  roles::text
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
