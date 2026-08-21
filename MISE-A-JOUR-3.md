# Mise à jour #3 — Sécurité, performance & confiance

Cette mise à jour applique **toutes** les recommandations de l'audit.

---

## ⚠️ À FAIRE EN PREMIER : ta base est ouverte

Avant ce correctif, n'importe qui pouvait récupérer **le nom, le téléphone et l'adresse de tous tes clients** avec une seule requête. Ce n'est pas théorique : je l'ai testé sur ta base, les données sont sorties en clair.

La clé `anon` est publique par nature (elle est dans le JavaScript envoyé au navigateur). Ce qui protège les données, c'est le RLS — et il n'était pas activé.

**Corrige ça avant tout le reste :**

1. Ouvre Supabase → **SQL Editor** → **New query**
2. Colle `supabase/01-securite-rls.sql` → **Run**
3. Colle `supabase/03-purge-policies.sql` → **Run**
4. Colle `supabase/04-nettoyage-tests.sql` → **Run** (efface mes lignes de test)

> **Pourquoi le script 03 ?** Ta base contenait déjà des policies créées via
> l'interface Supabase, avec des noms génériques (« Enable read access for all
> users »). Le script 01 supprimait les policies par leur nom et ne pouvait
> donc pas les connaître — or une seule policy permissive suffit à tout
> ouvrir. Le script 03 purge **toutes** les policies quel que soit leur nom,
> puis recrée uniquement les bonnes.

Les scripts sont idempotents : relançables sans risque.

### Vérifié sur ta base après exécution

| Test | Résultat |
|---|---|
| Lire `orders` / `notes` / `chat_messages` / `promo_codes` | `[]` — plus aucune fuite |
| Modifier un prix produit | 0 ligne affectée |
| Modifier ou supprimer une commande | 0 ligne affectée |
| Passer une commande (client) | ✅ fonctionne |
| Écrire dans le chat, relire sa conversation | ✅ fonctionne |
| Suivi `TOF-3148` | ✅ statut + `ba•••`, sans nom ni téléphone |
| Vitrine produits + réglages | ✅ lisibles |

### Puis le mot de passe admin

`supabase/02-admin-auth.sql` explique la procédure en 4 étapes. L'admin passe de « un mot de passe écrit dans le code » à **Supabase Auth** (vrai compte, session, mot de passe hashé).

> **Le point à ne pas rater :** dans Authentication → Providers → Email, **désactive « Enable Sign Up »**. Sinon n'importe qui peut créer un compte et se retrouver admin.

---

## 1. Sécurité (RLS + Auth)

| Table | Avant | Après |
|---|---|---|
| `orders` | tout le monde lit tout | insertion publique, lecture réservée à l'admin connecté |
| `promo_codes` | lisibles (donc devinables) | aucun accès direct, validation par fonction |
| `chat_messages` | toutes les conversations lisibles | chacun ne voit que la sienne |
| `notes` | publiques | admin uniquement |
| `products` / `settings` | — | lecture publique (c'est la vitrine), écriture admin |

Le suivi de commande passe maintenant par une fonction `track_order` qui renvoie **uniquement** le statut d'un numéro précis. Pour que le client confirme que c'est bien sa commande sans exposer son adresse, on affiche un indice de ville : `Ly•••`.

## 2. Images : −91 % de poids

Tes 115 images pèsent **27,9 Mo**. En WebP : **2,4 Mo**. Sur mobile en 4G, c'est la différence entre une page qui s'affiche et une page qu'on quitte.

```bash
# 1. Simulation, ne touche à rien :
npm run images:webp:dry

# 2. Pour de vrai (clé service_role : Supabase → Settings → API) :
SUPABASE_SERVICE_KEY=eyJhbGci... npm run images:webp
```

Le script ne supprime **jamais** les originaux : si quelque chose te déplaît, les anciennes URLs sont toujours valides.

Les nouvelles images uploadées depuis le panel sont désormais compressées en WebP directement dans le navigateur.

## 3. Chargement : 851 Ko → 626 Ko

Le site était livré en **un seul fichier** de 851 Ko : rien n'était mis en cache, et tes visiteurs téléchargeaient le panel admin alors qu'ils ne le verront jamais.

- Découpage en morceaux (React, Supabase, icônes, code du site) → au retour d'un visiteur, seuls les fichiers modifiés sont retéléchargés
- Le panel admin (**143 Ko**) ne se charge plus que sur `#admin`

## 4. Une URL par produit

Ouvrir un produit change maintenant l'adresse en `#produit/<id>`.

- Le bouton retour du téléphone referme la fiche au lieu de quitter le site
- Un **bouton Partager** est apparu sur la fiche : il ouvre le partage natif du téléphone (WhatsApp, Snap, Insta) ou copie le lien
- Envoyer un produit précis à un client devient possible

## 5. Relance des paniers abandonnés

Onglet **Commandes**, un bandeau en haut liste les commandes enregistrées mais **jamais payées**, avec le montant total en attente et depuis combien de temps elles traînent.

Deux boutons par ligne : **Relancer** (ouvre WhatsApp avec le message de relance prérempli) et **Payée ✓**.

## 6. Notifications de nouvelle commande

Dans le tableau de bord, une cloche active les notifications navigateur. Tu es prévenu d'une commande ou d'un message chat **même si l'onglet est fermé**.

Le son existant est conservé ; la notification ne s'affiche que si tu n'es pas déjà en train de regarder la page.

## 7. Photos QC visibles par le client

Sur chaque commande du panel, une zone **📸 Photos QC** permet d'uploader les photos de l'article avant expédition (compressées automatiquement).

Le client les voit sur sa page `#suivi`. Sur ce type de boutique, c'est l'argument qui rassure le plus : il voit *son* article, pas une photo catalogue.

> Nécessite l'exécution de `supabase/01-securite-rls.sql`, qui crée la colonne `qc_photos`.

## 8. Stock par taille

Dans le panel, chaque taille se clique en **3 états** :

| Clic | État | Sur le site |
|---|---|---|
| 1 | proposée | sélectionnable |
| 2 | **épuisée** | barrée, grisée, non cliquable |
| 3 | retirée | absente |

La première taille **disponible** est présélectionnée à l'ouverture de la fiche. Si tout est épuisé, un message invite le client à écrire pour une commande sur mesure.

Techniquement, le stock est stocké dans le champ tailles existant (`41:0` = épuisée) : **aucune migration de base nécessaire**.

## 10. Correction : scroll bloqué sur PC

Le site et le panel admin ne défilaient plus sur ordinateur.

`overflow-x: hidden` était appliqué à la fois sur `<html>` et `<body>` (garde-fou
anti-débordement horizontal mobile). Sur `<html>`, cette règle transforme la
racine du document en conteneur de défilement et **casse le scroll vertical de
toute la page** : `window.scrollY` restait bloqué à 0 alors que la page mesurait
9288 px.

La règle ne s'applique plus qu'à `<body>` — la protection anti-débordement
horizontal est conservée.

| Vérification | PC | Mobile |
|---|---|---|
| Scroll du site | ✅ | ✅ |
| Scroll du panel admin | ✅ | ✅ |
| Pas de débordement horizontal | ✅ | ✅ |
| Fiche produit : fond bien figé, scroll rétabli à la fermeture | ✅ | ✅ |

## 11. Détail : Échap ferme la fiche produit

Sur ordinateur, la touche Échap ne fermait pas la fiche produit — il fallait
viser le X. C'est le réflexe attendu de tout utilisateur PC, c'est corrigé.

La fermeture remet l'URL sur `#shop` et libère le scroll, exactement comme le
bouton X. Une garde évite de fermer la fiche si tu es en train de saisir
quelque chose dans un champ.

## 12. Bot : bugs corrigés + accès aux vraies données

### Les deux bugs que tu as signalés

**Supprimer une conversation dans l'admin ne la supprimait pas côté client.**
Deux causes cumulées : le temps réel n'écoutait que les `INSERT` (pas les
`DELETE`), et surtout, dès que la liste de messages était vide, le code
renvoyait automatiquement un message d'accueil — la conversation supprimée
**renaissait aussitôt**. Corrigé : le widget détecte la suppression, repart
sur une conversation neuve, et n'envoie plus rien.

> ⚠️ Nécessite d'exécuter `supabase/07-chat-realtime-delete.sql`. Sans ce
> script, Postgres n'émet pas les événements DELETE et le correctif reste
> sans effet.

**Le même message d'accueil à chaque connexion.** Il partait à chaque état
vide, y compris pendant le chargement asynchrone des messages. Il est
maintenant conditionné à un vrai premier contact.

### Le bot connaît enfin ton shop

Avant, il récitait des textes figés : il ne connaissait ni tes produits, ni
tes prix, ni tes commandes. Nouveau module `src/lib/botKnowledge.ts` :

| Question du client | Ce qu'il répond maintenant |
|---|---|
| « tu as du Louis Vuitton ? » | les vraies pièces LV du catalogue, avec prix et tailles dispo |
| « des sneakers à moins de 90 € » | comprend le budget et filtre |
| « où en est TOF-3148 ? » | statut réel, paiement, tracking, ville |
| « quelles marques ? » | la liste réelle, pas une liste écrite en dur |
| « quelles tailles pour X ? » | tailles dispo **et** épuisées |
| rien ne correspond | propose le sourcing sur mesure + les best-sellers |

Le catalogue est mis en cache 5 min. Tout passe par les fonctions déjà
protégées par RLS : le bot ne peut rien exposer qu'un visiteur ne voie déjà.

### Escalade automatique

Après **2 incompréhensions d'affilée**, le bot arrête de tourner en rond et
passe la main : « Là je bloque — écris directement à Tof sur WhatsApp ».
Un bot qui répète « je n'ai pas compris » fait fuir ; mieux vaut qu'il
reconnaisse sa limite et t'amène le client.

## 13. Bot : compréhension du langage réel

Tes clients écrivent sur mobile, vite, en abrégé et avec des fautes. Un moteur
qui compare des chaînes exactes rate tout ça et répond « je n'ai pas compris » —
le client s'en va. Nouveau module `src/lib/botNlp.ts`.

**Ce qu'il comprend maintenant** (testé) :

| Message client | Résultat |
|---|---|
| « vs avez du lv ? » | sort les 4 pièces Louis Vuitton avec prix et tailles |
| « je cherche des snekers a moin de 90 euro » | comprend la faute **et** le budget |
| « c koi les tailel dispo ? » | comprend la question de tailles |
| « mon panier » | liste le panier réel + total |
| « JE VEUX ETRE REMBOURSE CEST UNE ARNAQUE » | escalade immédiate, ton adapté |

**Comment :**
- **Dictionnaire SMS** : `vs`→vous, `cb`→combien, `jvx`→je veux, `cmd`→commande...
- **Correspondance floue** (distance de Levenshtein) : tolère 1 à 3 fautes selon
  la longueur du mot. « livrezon » → livraison.
- **Détection d'humeur** : insultes, majuscules soutenues, ponctuation multiple,
  mots de litige. Un client énervé n'a pas à subir un parcours de bot : escalade
  directe, sans tourner en rond.
- **Messages vides** (« ok », « mdr ») : réponse courte, pas une tartine.

### Conscience du contexte

- **Panier** : « mon panier » → contenu réel + total.
- **Produit consulté** : « et en 42 ? » porte sur la pièce que le client vient
  de regarder, sans qu'il ait à la renommer.
- **Heure réelle** : le bot ne promet plus « réponse en 5 min » à 3h du matin.
  Il annonce un délai crédible — une promesse non tenue coûte plus cher qu'une
  attente annoncée.
- **Question de tailles hors contexte** : il demande de quelle pièce il s'agit
  au lieu de deviner et de sortir des claquettes pour une question sneakers.

### Les échecs te remontent

Quand le bot sèche ou passe la main, il écrit dans la conversation un marqueur
`⚠️ À REPRENDRE — le bot n'a pas su répondre à : « ... »`. **Invisible pour le
client**, visible pour toi dans l'admin. Tu vois d'un coup d'œil les
conversations à rattraper — et les questions qui reviennent te disent quoi
ajouter au bot.

## 14. Panel admin : onglet Chat complet

L'onglet Chat servait à lire et répondre. Il sert maintenant à **savoir qui traiter en premier**.

### Repérer l'urgent d'un coup d'œil

La 4ᵉ tuile est devenue **« Bot bloqué »** : le nombre de conversations où l'assistant
a séché. Elle passe en rouge dès qu'il y en a une. C'est ta pile à traiter.

Dans la liste, chaque conversation peut porter deux badges :

| Badge | Sens |
|---|---|
| ⚠️ **Bot bloqué** | Le bot n'a pas su répondre, le client attend une vraie réponse |
| ⏱ **12 min** / **3 h** | Depuis combien de temps le client attend (orange, puis rouge après 1 h) |

Le tri suit cette logique : d'abord les conversations où le bot a bloqué, puis celles
sans réponse **en commençant par celui qui attend depuis le plus longtemps**, puis le reste.
Plus besoin de scroller pour trouver qui est en train de s'impatienter.

### Recherche et filtres

Une barre de recherche cherche à la fois dans **les noms et le contenu des messages** —
pratique pour retrouver « le gars qui demandait une taille 43 ». À côté, trois filtres :
**Tout**, **À répondre**, **⚠️ Bot bloqué**, chacun avec son compteur.

### Le marqueur du bot devient une vraie alerte

Le message interne `⚠️ À REPRENDRE` (invisible côté client) s'affichait comme un message
de bot normal. Il apparaît maintenant comme un **encadré rouge centré**, avec la question
exacte à laquelle le bot n'a pas su répondre et la mention « visible par toi seul ».
Un clic sur ✕ le marque comme traité. Dans la liste, l'aperçu affiche
« Question sans réponse du bot » au lieu du texte technique.

### Fiche client dans la conversation

Si le nom du client correspond à des commandes, elles s'affichent **en bandeau au-dessus
des messages** : numéro, statut, présence d'un suivi. Tu réponds « ta commande est expédiée »
sans changer d'onglet.

Conséquence directe : le bouton **WhatsApp** récupère le **numéro réel** du client depuis
sa commande (converti au format international) et ouvre la bonne discussion. Avant, il
ouvrait WhatsApp sans destinataire. S'il n'y a pas de numéro connu, le bouton affiche
« WhatsApp ? ».

### Réponses rapides personnalisées

Les réponses toutes faites insèrent le prénom du client : « Salut ! » devient
« Salut Marie ! » automatiquement.

### Export et délai de réponse

Un bouton **⬇** exporte la conversation en `.txt` (horodatée, avec les noms) — utile pour
garder une trace d'un litige. Et la tuile « À répondre » affiche ton **délai de réponse
moyen**, calculé sur les 20 dernières conversations.

### Deux bugs corrigés au passage

- **Conversations marquées « à répondre » à tort.** Le calcul comparait les identifiants
  de messages entre eux (`m-admin-123` contre `m-456`), ce qui est faux dès que l'admin
  répond. Une conversation déjà traitée restait en attente indéfiniment. Le calcul se base
  désormais sur l'ordre réel des messages : le compteur « À répondre » est enfin juste.
- **Compteurs faussés par les filtres.** Les tuiles se seraient mises à compter la liste
  filtrée au lieu du total réel.

**Testé dans un vrai navigateur** : affichage, filtres, recherche, encadré d'escalade et
tri par priorité vérifiés sur un jeu de 4 conversations, sans aucune erreur JavaScript.

## 15. Bot : il se souvient après un rechargement

Un défaut connu qu'on avait laissé de côté : le bot perdait la mémoire dès que
le visiteur rechargeait la page. Il resservait alors sa réponse complète,
mot pour mot, comme si vous ne vous étiez jamais parlé.

La cause : la liste des sujets déjà abordés était vidée à chaque chargement.

Désormais la mémoire du bot est conservée (sujets traités, prénom, humeur,
nombre d'échanges). Concrètement, si le client repose une question déjà traitée,
le bot répond « **Pour rappel :** … » au lieu de recopier sa tartine.

La mémoire est effacée automatiquement dans deux cas : quand le visiteur clique
sur « Recommencer », et quand tu supprimes la conversation depuis l'admin
(sinon le bot repartirait avec un souvenir fantôme).

**Testé dans un vrai navigateur** : question posée, rechargement de page,
même question reposée → le bot enchaîne par « Pour rappel » et garde le prénom.
Aucune erreur JavaScript.

## 16. Fiches produit : descriptions

⚠️ **Nécessite d'exécuter `supabase/08-description-produit.sql`.**

Ta fiche produit affichait la marque, le nom, le prix et deux badges. Rien
d'autre. Pour un maillot Burberry à 70 €, le client n'avait aucune réponse :
quelle matière ? ça taille comment ? qu'est-ce qu'il y a dans le colis ?
Sans réponse au moment où il hésite, il ferme l'onglet.

Trois champs facultatifs sont maintenant disponibles dans l'admin, sur la
fiche de chaque produit :

| Champ | Exemple |
|---|---|
| **Description** (600 car. max) | « Coton épais 280g, coupe droite légèrement oversize. Broderie sur la poitrine, finitions propres. » |
| **Conseil de taille** | « Taille normalement », « Prends une taille au-dessus » |
| **Contenu du colis** | « Paire + boîte + dustbag », « Pièce + étiquettes » |

Côté client, la description s'affiche juste sous le prix, et les deux autres
champs deviennent des pastilles. **Un produit sans description s'affiche
exactement comme avant** — tu remplis à ton rythme, en commençant par tes
pièces les plus chères.

**Sécurité** : si tu appliques cette mise à jour avant d'avoir lancé le SQL 08,
l'enregistrement d'un produit aurait dû échouer (`PGRST204`). Le code détecte
ce cas et réenregistre sans les nouveaux champs, pour ne jamais te faire perdre
ton travail. Une fois le SQL lancé, tout fonctionne normalement.

## 17. Mobile : bas d'écran désencombré

Sur un écran de 390 px, la pastille « VÉRIFIÉ 🔍 » du hero venait se superposer
au bouton de chat, juste au-dessus de la barre Boutique / Panier / WhatsApp.
Trois éléments empilés dans le même coin : ça mangeait le contenu et ça faisait
« site qui insiste ». La pastille est désormais masquée sur mobile et reste
visible sur ordinateur, où la place ne manque pas.

## 18. Tunnel d'achat : testé de bout en bout

Personne n'avait jamais parcouru ton tunnel d'achat en entier. Je l'ai fait :
5 vraies commandes passées depuis un navigateur mobile, du clic sur le produit
jusqu'à l'écran de confirmation.

**Résultat : ça marche.** Choix taille/couleur → Acheter maintenant → panier →
formulaire → `POST 201` en base → numéro `TOF-XXXX` généré → écran de
confirmation. Zéro erreur JavaScript. Le suivi de commande retrouve bien la
commande, avec la ville masquée (`Ba•••`) comme prévu.

**La sécurité tient aussi** : en tant que visiteur anonyme, la lecture directe
de la table `orders` renvoie `[]`, et la suppression est refusée. Seul le suivi
par numéro fonctionne. C'est exactement le comportement attendu.

### Un défaut corrigé : le bouton « Payer » qui ne menait nulle part

Tant que `sumupUrl` vaut `#`, le bouton **« Payer 78 € par carte (SumUp) »**
s'affichait quand même. Le client cliquait… et il ne se passait rien. Aucun
message, aucune explication. C'est le pire moment pour perdre quelqu'un : il a
rempli tout le formulaire, il est prêt à payer.

Désormais, tant que le lien n'est pas configuré, le bouton est remplacé par :

> **Ta commande est bien enregistrée ✅**
> Contacte-moi sur WhatsApp juste en dessous : je t'envoie ton lien de paiement
> sécurisé et je lance ta commande.

Le client est orienté vers WhatsApp, qui fonctionne toujours. **Dès que tu
colles ton lien SumUp dans les Réglages, le bouton de paiement réapparaît
automatiquement** — rien d'autre à faire.

### ⚠️ À faire : supprimer mes commandes de test

Mes 5 commandes de test sont encore en base et fausseraient ton chiffre
d'affaires. Exécute **`supabase/09-supprimer-commandes-test.sql`**.

## 9. Référencement & partage

- `public/og-image.jpg` (1200×630, 30 Ko) : l'aperçu qui s'affiche quand on colle ton lien sur WhatsApp, Insta ou Snap
- `public/robots.txt` : le panel admin est exclu des moteurs de recherche
- `public/sitemap.xml` : les 4 pages du site
- Balises `og:` et `twitter:` complétées dans `index.html`

> **Vérifie le domaine.** J'ai utilisé `https://tof-shop.vercel.app` dans ces 3 fichiers. Si ton adresse est différente, remplace-la (recherche/remplacement simple).

---

## Installation

```bash
cd ~/chemin/vers/tof-shop
unzip -o ~/Downloads/tof-shop-update-3.zip -d .

npm install          # sharp est ajouté, vite-plugin-singlefile retiré
npm run build

git add .
git commit -m "Sécurité RLS + auth admin, WebP, découpage bundle, URL produit, relance paniers, notifications, photos QC, stock par taille, SEO"
git push origin main
```

---

## Ta checklist

- [x] ~~Exécuter `supabase/01-securite-rls.sql`~~ — fait
- [x] ~~Exécuter `supabase/03-purge-policies.sql`~~ — fait, fuite confirmée fermée
- [ ] Exécuter `supabase/04-nettoyage-tests.sql` (efface mes 2 lignes de test)
- [x] ~~Suivre `supabase/02-admin-auth.sql`~~ — fait, inscriptions fermées (vérifié)
- [ ] Si la connexion admin refuse l'accès : exécuter `supabase/05-confirmer-admin.sql`
- [ ] Retirer la ligne `VITE_ADMIN_PASSWORD=` de ton fichier `.env` (devenue inutile)
- [ ] Lancer `npm run images:webp` avec la clé service_role
- [ ] Vérifier le domaine dans `robots.txt`, `sitemap.xml`, `index.html`
- [ ] Coller le vrai lien SumUp dans les réglages (toujours `#`)
- [ ] Corriger le texte de la barre d'annonce qui mentionne encore `TOFLAUNCH`
- [ ] Tester le suivi avec un vrai numéro `TOF-XXXX`
- [ ] Activer les notifications depuis le tableau de bord

> Tant que le script SQL n'est pas exécuté, la page d'accueil affiche un avertissement en console (`recent_orders_public indisponible`) et les popups de commandes récentes restent vides. C'est normal, ça se règle tout seul après le `Run`.
