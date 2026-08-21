-- ============================================================================
--  tof-shop — Nettoyage du catalogue (marques & noms)
-- ============================================================================
--  CE QUE ÇA CORRIGE
--  -----------------
--  Constaté sur tes 35 produits :
--   • 6 marques écrites de plusieurs façons — "FENDI" et "Fendi",
--     "CP COMPANY" et "Cp Company", "LOUIS VUITTON" et "Louis Vuitton"...
--     Sur les fiches produit, la même marque s'affiche différemment
--     selon l'article. Ça fait négligé, et si tu ajoutes un jour un filtre
--     par marque, elles apparaîtront en double.
--   • 10 produits avec des espaces parasites en début/fin de nom
--     ("Gucci slides ", " On Cloudtilt Remix", "T-shirt  LV").
--
--  À exécuter dans Supabase → SQL Editor → Run.
--  Idempotent : relançable sans risque.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. AVANT — regarde ce qui va changer
-- ─────────────────────────────────────────────────────────────────────────────
select
  brand                                   as marque_actuelle,
  count(*)                                as nb_produits
from public.products
group by brand
order by lower(trim(brand)), brand;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Espaces parasites (début, fin, et doubles espaces internes)
-- ─────────────────────────────────────────────────────────────────────────────
update public.products
set
  brand = regexp_replace(trim(brand), '\s+', ' ', 'g'),
  name  = regexp_replace(trim(name),  '\s+', ' ', 'g')
where brand <> regexp_replace(trim(brand), '\s+', ' ', 'g')
   or name  <> regexp_replace(trim(name),  '\s+', ' ', 'g');


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Orthographe unifiée des marques
-- ─────────────────────────────────────────────────────────────────────────────
--  On aligne sur l'écriture officielle de chaque maison.
--  Ajoute tes propres lignes ici si tu introduis de nouvelles marques.

update public.products set brand = 'Louis Vuitton' where lower(trim(brand)) = 'louis vuitton';
update public.products set brand = 'Fendi'         where lower(trim(brand)) = 'fendi';
update public.products set brand = 'Casablanca'    where lower(trim(brand)) = 'casablanca';
update public.products set brand = 'CP Company'    where lower(trim(brand)) = 'cp company';
update public.products set brand = 'Hermès'        where lower(trim(brand)) in ('hermes', 'hermès');
update public.products set brand = 'Asics'         where lower(trim(brand)) = 'asics';
update public.products set brand = 'New Balance'   where lower(trim(brand)) = 'new balance';
update public.products set brand = 'On'            where lower(trim(brand)) = 'on';
update public.products set brand = 'Gucci'         where lower(trim(brand)) = 'gucci';
update public.products set brand = 'Dior'          where lower(trim(brand)) = 'dior';
update public.products set brand = 'Chanel'        where lower(trim(brand)) = 'chanel';
update public.products set brand = 'Alo'           where lower(trim(brand)) = 'alo';
update public.products set brand = 'Loro Piana'    where lower(trim(brand)) = 'loro piana';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. APRÈS — chaque marque ne doit plus apparaître qu'une seule fois
-- ─────────────────────────────────────────────────────────────────────────────
select
  brand                                   as marque_finale,
  count(*)                                as nb_produits
from public.products
group by brand
order by brand;
