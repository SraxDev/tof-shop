-- ============================================================================
--  tof-shop — Supprimer la dernière commande de test
-- ============================================================================
--  J'ai passé une commande de test (TOF-8805, « Test Final ») pour vérifier la
--  nouvelle règle « paiement avant commande ». Le test est concluant :
--  la commande arrive bien avec le statut « Nouvelle » et non « À commander ».
--
--  Ce script la supprime. Comme pour le script 09 : sélectionne TOUT le
--  contenu (ou ne sélectionne rien) avant de cliquer sur Run, sinon seule la
--  partie surlignée s'exécute.
-- ============================================================================

delete from public.orders where id = 'TOF-8805';

-- Vérification — doit renvoyer 0
select count(*) as restantes from public.orders where id = 'TOF-8805';
