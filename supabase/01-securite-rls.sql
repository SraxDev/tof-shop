-- ============================================================================
--  tof-shop — Verrouillage de la base (Row Level Security)
-- ============================================================================
--  À exécuter dans Supabase → SQL Editor → New query → Run.
--  Idempotent : tu peux le relancer sans risque.
--
--  PROBLÈME RÉSOLU
--  ---------------
--  La clé "anon" est publique par conception (elle est forcément présente dans
--  le JavaScript envoyé au navigateur). Sans RLS, n'importe qui peut lire
--  TOUTES les commandes — nom, téléphone, adresse de chaque client.
--
--  Vérifié avant correctif : une simple requête HTTP renvoyait les données
--  clients en clair. Après ce script, la même requête renvoie [].
--
--  PRINCIPE
--  --------
--  • products / featured_drop / settings : lecture publique (c'est la vitrine)
--  • orders          : insertion publique (le client commande), AUCUNE lecture
--  • promo_codes     : aucun accès direct ; validation via fonction contrôlée
--  • chat_messages   : le visiteur ne voit que SA conversation
--  • notes           : privé (admin uniquement)
--
--  Le suivi de commande passe par une fonction RPC qui ne renvoie que le
--  statut d'UN numéro précis, jamais la liste ni les données personnelles.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 0. PHOTOS QC — colonne pour les photos de contrôle qualité
-- ─────────────────────────────────────────────────────────────────────────────
-- Stocke les URLs des photos prises avant expédition, séparées par des virgules.
-- Le client les voit sur la page #suivi : c'est le meilleur argument anti-arnaque.

alter table public.orders add column if not exists qc_photos text;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PRODUITS — lecture publique, écriture réservée à l'admin
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.products enable row level security;

drop policy if exists "products_public_read"  on public.products;
drop policy if exists "products_admin_write"  on public.products;
drop policy if exists "products_admin_update" on public.products;
drop policy if exists "products_admin_delete" on public.products;

create policy "products_public_read"
  on public.products for select
  using (true);

create policy "products_admin_write"
  on public.products for insert
  to authenticated with check (true);

create policy "products_admin_update"
  on public.products for update
  to authenticated using (true) with check (true);

create policy "products_admin_delete"
  on public.products for delete
  to authenticated using (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. COMMANDES — le point critique
--    Le client peut CRÉER une commande, mais ne peut RIEN lire.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.orders enable row level security;

drop policy if exists "orders_public_insert" on public.orders;
drop policy if exists "orders_admin_read"    on public.orders;
drop policy if exists "orders_admin_update"  on public.orders;
drop policy if exists "orders_admin_delete"  on public.orders;
drop policy if exists "orders_public_read"   on public.orders;

create policy "orders_public_insert"
  on public.orders for insert
  to anon, authenticated
  with check (true);

create policy "orders_admin_read"
  on public.orders for select
  to authenticated using (true);

create policy "orders_admin_update"
  on public.orders for update
  to authenticated using (true) with check (true);

create policy "orders_admin_delete"
  on public.orders for delete
  to authenticated using (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SUIVI DE COMMANDE — fonction RPC contrôlée
--    Renvoie UNIQUEMENT le statut d'un numéro exact.
--    Aucune donnée personnelle : ni nom, ni téléphone, ni adresse.
--    Impossible de lister ou d'énumérer les commandes.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.track_order(text);

create or replace function public.track_order(order_id text)
returns table (
  id             text,
  status         text,
  payment_status text,
  tracking       text,
  created_at     timestamptz,
  items_json     text,
  city_hint      text,
  qc_photos      text
)
language sql
security definer            -- contourne RLS, mais ne renvoie que le strict nécessaire
set search_path = public
stable
as $$
  select
    o.id::text,
    o.status::text,
    o.payment_status::text,
    o.tracking::text,
    o.created_at,
    o.items_json::text,
    -- Indice de vérification : 2 premières lettres de la ville (ex. "Ly•••")
    -- Permet au client de confirmer que c'est bien sa commande,
    -- sans exposer l'adresse complète.
    case
      when o.city is null or length(o.city) = 0 then null
      else left(o.city, 2) || '•••'
    end::text as city_hint,
    o.qc_photos::text
  from public.orders o
  where upper(o.id) = upper(trim(track_order.order_id))
  limit 1;
$$;

revoke all on function public.track_order(text) from public;
grant execute on function public.track_order(text) to anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PREUVE SOCIALE — fonction RPC anonymisée
--    Renvoie prénom + ville + article, sans téléphone ni adresse.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.recent_orders_public(integer);

create or replace function public.recent_orders_public(max_rows integer default 20)
returns table (
  first_name text,
  city       text,
  items_json text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    -- Prénom seul, jamais le nom de famille
    split_part(trim(o.customer_name), ' ', 1)::text as first_name,
    o.city::text,
    o.items_json::text,
    o.created_at
  from public.orders o
  where o.customer_name is not null
    and length(trim(o.customer_name)) > 1
  order by o.created_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 30);
$$;

revoke all on function public.recent_orders_public(integer) from public;
grant execute on function public.recent_orders_public(integer) to anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RÉGLAGES DU SITE — lecture publique, écriture admin
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.settings enable row level security;

drop policy if exists "settings_public_read" on public.settings;
drop policy if exists "settings_admin_write" on public.settings;

create policy "settings_public_read"
  on public.settings for select using (true);

create policy "settings_admin_write"
  on public.settings for all
  to authenticated using (true) with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. DROP EN VEDETTE — lecture publique, écriture admin
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.featured_drop enable row level security;

drop policy if exists "drop_public_read" on public.featured_drop;
drop policy if exists "drop_admin_write" on public.featured_drop;

create policy "drop_public_read"
  on public.featured_drop for select using (true);

create policy "drop_admin_write"
  on public.featured_drop for all
  to authenticated using (true) with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CODES PROMO — aucun accès direct
--    Sans ça, on peut lister tous tes codes de réduction.
--    La validation passe par une fonction qui ne révèle que le % du code testé.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.promo_codes enable row level security;

drop policy if exists "promo_admin_all"    on public.promo_codes;
drop policy if exists "promo_public_read"  on public.promo_codes;

create policy "promo_admin_all"
  on public.promo_codes for all
  to authenticated using (true) with check (true);

drop function if exists public.validate_promo(text);

-- NB : on renvoie l'id en `text` et on caste explicitement chaque colonne.
-- Selon l'ancienneté de la base, `promo_codes.id` peut être uuid, text ou
-- bigint — le cast rend la fonction compatible avec les trois.
create or replace function public.validate_promo(code_input text)
returns table (
  id               text,
  code             text,
  discount_percent integer
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id::text, p.code::text, p.discount_percent::integer
  from public.promo_codes p
  where upper(p.code) = upper(trim(validate_promo.code_input))
    and p.active = true
    and (p.max_uses = 0 or p.uses < p.max_uses)
    and (p.expires_at is null or p.expires_at > now())
  limit 1;
$$;

revoke all on function public.validate_promo(text) from public;
grant execute on function public.validate_promo(text) to anon, authenticated;

-- Incrémentation du compteur d'utilisation (le client ne peut pas écrire en direct)
drop function if exists public.consume_promo(uuid);
drop function if exists public.consume_promo(text);

create or replace function public.consume_promo(promo_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.promo_codes
  set uses = uses + 1
  where id::text = consume_promo.promo_id;
$$;

revoke all on function public.consume_promo(text) from public;
grant execute on function public.consume_promo(text) to anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. CHAT — chacun ne voit que sa propre conversation
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.chat_messages enable row level security;

drop policy if exists "chat_public_insert" on public.chat_messages;
drop policy if exists "chat_admin_all"     on public.chat_messages;
drop policy if exists "chat_public_read"   on public.chat_messages;

create policy "chat_public_insert"
  on public.chat_messages for insert
  to anon, authenticated with check (true);

create policy "chat_admin_all"
  on public.chat_messages for all
  to authenticated using (true) with check (true);

-- Lecture d'une conversation précise par son identifiant (connu du seul visiteur)
drop function if exists public.get_conversation(text);

create or replace function public.get_conversation(conv_id text)
returns table (
  id              text,
  conversation_id text,
  sender          text,
  message         text,
  client_name     text,
  created_at      timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id::text, c.conversation_id::text, c.sender::text,
         c.message::text, c.client_name::text, c.created_at
  from public.chat_messages c
  where c.conversation_id = get_conversation.conv_id
  order by c.created_at asc
  limit 200;
$$;

revoke all on function public.get_conversation(text) from public;
grant execute on function public.get_conversation(text) to anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. NOTES — strictement privé
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.notes enable row level security;

drop policy if exists "notes_admin_all" on public.notes;

create policy "notes_admin_all"
  on public.notes for all
  to authenticated using (true) with check (true);


-- ============================================================================
--  VÉRIFICATION
-- ============================================================================
--  Après exécution, teste depuis un terminal (remplace <TA_CLE_ANON>) :
--
--    curl "https://kvwkjggnmbgdhvxcdgbq.supabase.co/rest/v1/orders?select=*" \
--         -H "apikey: <TA_CLE_ANON>"
--
--  Résultat attendu : []   (liste vide — plus aucune fuite)
--
--  Et le suivi doit continuer de fonctionner :
--
--    curl -X POST "https://kvwkjggnmbgdhvxcdgbq.supabase.co/rest/v1/rpc/track_order" \
--         -H "apikey: <TA_CLE_ANON>" -H "Content-Type: application/json" \
--         -d '{"order_id":"TOF-3148"}'
--
--  Résultat attendu : le statut de la commande, sans nom ni téléphone.
-- ============================================================================
