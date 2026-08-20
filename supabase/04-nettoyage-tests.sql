-- ============================================================================
--  Nettoyage des données de test créées pendant la vérification RLS
-- ============================================================================
--  Pour confirmer qu'un client peut toujours commander et écrire dans le chat
--  après le verrouillage, j'ai inséré deux lignes de test. Le RLS m'empêche
--  maintenant de les supprimer avec la clé publique (c'est le but !).
--
--  Colle ceci dans Supabase → SQL Editor → Run pour les effacer.
--  Sans danger : cible uniquement les identifiants de test.
-- ============================================================================

delete from public.orders        where id = 'TOF-TEST-RLS';
delete from public.chat_messages where conversation_id = 'conv-rls-test';

-- Vérification : les deux requêtes doivent renvoyer 0
select
  (select count(*) from public.orders        where id = 'TOF-TEST-RLS')            as commandes_test_restantes,
  (select count(*) from public.chat_messages where conversation_id = 'conv-rls-test') as messages_test_restants;
