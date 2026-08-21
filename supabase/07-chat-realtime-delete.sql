-- ============================================================================
--  tof-shop — Rendre les suppressions de chat visibles en temps réel
-- ============================================================================
--  PROBLÈME
--  --------
--  Tu supprimes une conversation depuis l'admin, mais côté visiteur elle
--  reste affichée. Deux causes :
--
--   1. Le code n'écoutait que les INSERT (corrigé dans src/lib/db.ts).
--   2. Postgres n'envoie l'événement DELETE que si la table est configurée
--      en REPLICA IDENTITY FULL. Sans ça, le DELETE part "vide" et Supabase
--      ne peut pas le diffuser. C'est ce que corrige ce script.
--
--  À exécuter dans Supabase → SQL Editor → Run. Idempotent.
-- ============================================================================


-- 1. Permet à Postgres de diffuser les DELETE avec le contenu de la ligne
alter table public.chat_messages replica identity full;


-- 2. S'assure que la table est bien publiée en temps réel
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;


-- 3. Vérification — doit renvoyer une ligne avec replica_identity = 'f' (full)
select
  c.relname                as table_name,
  case c.relreplident
    when 'f' then 'full ✅ (les DELETE seront diffusés)'
    when 'd' then 'default ❌ (les DELETE ne seront PAS diffusés)'
    else c.relreplident::text
  end                      as replica_identity,
  case when exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'chat_messages'
  ) then 'publiée ✅' else 'non publiée ❌' end as realtime
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'chat_messages';
