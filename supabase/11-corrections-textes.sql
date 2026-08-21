-- =============================================================
-- 11 — Corrections des textes en base (fautes visibles sur la home)
-- À exécuter dans Supabase → SQL Editor.
-- Idempotent : ne modifie que si le texte fautif exact est présent.
-- =============================================================

-- 1) Drop : "Exclusivite tof." → "Exclusivité tof."
update public.featured_drop
set eyebrow = 'Exclusivité tof.'
where eyebrow = 'Exclusivite tof.';

-- 2) Drop : description avec fautes d'accord / de grammaire
--    "Sur plus de 7 coloris disponible !" → "disponibles"
--    "avant que le promo ne parte"      → "avant que la promo ne parte"
--    "( un code promo n'est pas valable à cette offre )" → phrase corrigée
update public.featured_drop
set description = replace(
  replace(
    replace(
      description,
      'coloris disponible !',
      'coloris disponibles !'
    ),
    'avant que le promo ne parte',
    'avant que la promo ne parte'
  ),
  '( un code promo n''est pas valable à cette offre )',
  '(Un code promo n''est pas valable sur cette offre.)'
)
where description like '%coloris disponible !%'
   or description like '%avant que le promo ne parte%'
   or description like '%valable à cette offre%';

-- 3) Réparer les espaces autour des parenthèses dans le drop, au cas où
update public.featured_drop
set description = replace(
  replace(description, '( ', '('),
  ' )', ')'
)
where description like '%( %' or description like '% )%';

-- Vérification
select id, eyebrow, description from public.featured_drop;
