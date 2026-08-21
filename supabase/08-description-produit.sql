-- ============================================================================
--  tof-shop — Ajouter une description aux produits
-- ============================================================================
--  POURQUOI
--  --------
--  La fiche produit n'affiche aujourd'hui que la marque, le nom et le prix.
--  Le client qui hésite sur une pièce à 70-130 € n'a aucune réponse à ses
--  questions : quelle matière ? ça taille comment ? qu'est-ce qu'il y a dans
--  le colis ? Sans réponse, il ferme l'onglet.
--
--  Ce script ajoute trois champs facultatifs. Tu les remplis quand tu veux,
--  produit par produit, depuis l'admin. Un produit sans description continue
--  de s'afficher exactement comme avant.
--
--  À exécuter dans Supabase → SQL Editor → Run. Idempotent (relançable).
-- ============================================================================


-- 1. Description libre (matière, coupe, détails, ce que tu veux dire au client)
alter table public.products
  add column if not exists description text;

-- 2. Conseil de taille : "Taille normalement", "Prends une taille au-dessus"...
alter table public.products
  add column if not exists size_advice text;

-- 3. Ce que le client reçoit : "Paire + boîte + dustbag", "Pièce seule"...
alter table public.products
  add column if not exists box_content text;


-- 4. Vérification — doit renvoyer 3 lignes
select
  column_name  as colonne,
  data_type    as type,
  'ajoutée ✅' as etat
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'products'
  and column_name in ('description', 'size_advice', 'box_content')
order by column_name;
