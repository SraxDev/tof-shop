-- ============================================================================
--  tof-shop — Supprimer les commandes de test
-- ============================================================================
--  POURQUOI
--  --------
--  J'ai passé 5 vraies commandes de bout en bout pour vérifier que ton tunnel
--  d'achat fonctionne (il fonctionne : POST 201, numéro généré, suivi OK).
--
--  Ces commandes de test sont encore dans ta base. Elles fausseraient ton
--  chiffre d'affaires et la relance de paniers abandonnés. Ce script les
--  supprime.
--
--  Note : je n'ai pas pu les supprimer moi-même, et c'est une BONNE nouvelle.
--  La sécurité RLS bloque toute suppression par un visiteur anonyme — elle
--  fait donc exactement son travail.
--
--  À exécuter dans Supabase → SQL Editor → Run.
-- ============================================================================


-- 1. Voir ce qui va être supprimé (lance d'abord ceci pour contrôler)
select id, customer_name, city, created_at
from public.orders
where id in ('TOF-2836', 'TOF-2847', 'TOF-6131', 'TOF-3084', 'TOF-2112');


-- 2. Suppression
delete from public.orders
where id in ('TOF-2836', 'TOF-2847', 'TOF-6131', 'TOF-3084', 'TOF-2112');


-- 3. Vérification — doit renvoyer 0
select count(*) as commandes_test_restantes
from public.orders
where id in ('TOF-2836', 'TOF-2847', 'TOF-6131', 'TOF-3084', 'TOF-2112');


-- ============================================================================
--  Variante : si tu veux repartir d'une base totalement vide avant ta première
--  vraie vente, décommente la ligne ci-dessous. ATTENTION, elle efface TOUTES
--  les commandes, sans retour possible.
-- ============================================================================
-- delete from public.orders;
