-- ============================================================================
--  Débloquer la connexion au panel admin
-- ============================================================================
--  SYMPTÔME
--  --------
--  Tu as créé le compte depuis Supabase, tu saisis le bon email et le bon
--  mot de passe, et le panel refuse l'accès.
--
--  CAUSE LA PLUS FRÉQUENTE
--  -----------------------
--  Sur ton projet, la confirmation d'email est obligatoire
--  (mailer_autoconfirm = false). Un compte créé à la main reste donc
--  "non confirmé" tant que le lien reçu par mail n'est pas cliqué —
--  et Supabase refuse la connexion, en renvoyant un message trompeur.
--
--  À exécuter dans Supabase → SQL Editor → Run.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DIAGNOSTIC — regarde d'abord l'état de tes comptes
-- ─────────────────────────────────────────────────────────────────────────────
--  • email_confirmed_at à NULL  → c'est LA cause, passe à l'étape 2
--  • aucune ligne               → le compte n'existe pas (mauvais email ?)
--  • plusieurs lignes           → tu as peut-être créé un doublon avec une faute

select
  email,
  case when email_confirmed_at is null
       then '❌ NON CONFIRMÉ — connexion impossible'
       else '✅ confirmé'
  end                                as etat_email,
  case when banned_until is not null and banned_until > now()
       then '❌ compte suspendu'
       else '✅ actif'
  end                                as etat_compte,
  created_at,
  last_sign_in_at
from auth.users
order by created_at desc;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CORRECTION — confirme tous les comptes existants
-- ─────────────────────────────────────────────────────────────────────────────
--  Sans danger : les inscriptions publiques sont fermées (disable_signup),
--  donc les seuls comptes présents sont ceux que TU as créés.

update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VÉRIFICATION — tout doit être ✅
-- ─────────────────────────────────────────────────────────────────────────────
select
  email,
  case when email_confirmed_at is null then '❌ encore bloqué' else '✅ peut se connecter' end as etat
from auth.users
order by created_at desc;


-- ============================================================================
--  SI LE PROBLÈME PERSISTE APRÈS ÇA
--  --------------------------------
--  C'est alors le mot de passe. Réinitialise-le proprement :
--    Authentication → Users → clic sur le compte → "Reset password"
--  ou supprime le compte et recrée-le avec
--    "Add user" → "Create new user" → coche "Auto Confirm User".
--
--  Pense aussi à vérifier :
--   • pas d'espace avant/après l'email (le champ le retire déjà, mais bon)
--   • le mot de passe ne contient pas de caractère saisi via une autre
--     disposition clavier (@ sur AZERTY/QWERTY par exemple)
-- ============================================================================
