# tof. — drip authentique

Boutique en ligne de sneakers & streetwear (reps 1:1 sélectionnées pièce par pièce), avec tunnel de vente complet : réservation sur le site, paiement sécurisé (SumUp), suivi de commande, chat bot, et panel admin.

Déployé sur **Vercel** → [tof-shop.vercel.app](https://tof-shop.vercel.app/)

---

## Stack

| Couche | Techno |
|---|---|
| Frontend | React 19 + TypeScript + Vite 7 |
| Style | Tailwind CSS 4 |
| Icônes | lucide-react |
| Backend / données | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Paiement | SumUp (lien de paiement CB / Apple Pay / Google Pay) |
| Hébergement | Vercel |

## Fonctionnalités

- **Catalogue** : filtres (genre, catégorie), tri, recherche, stock par taille (disponible / épuisée / retirée), une URL par produit (`#produit/<id>`) + bouton partage natif
- **Drop mis en avant** avec compte à rebours
- **Panier** → commande avec numéro `TOF-XXXX` + lien de paiement
- **Suivi de commande** `#suivi` : statut + indice de ville (`Ly•••`), photos QC visibles par le client
- **Chat bot** temps réel (Supabase Realtime) qui connaît le catalogue
- **Panel admin** `#admin` (chargé uniquement sur cette route) : commandes, relance des paniers abandonnés, stock par taille, photos QC, code promo, réglages du site, notifications navigateur
- **Performance** : images WebP (−91 %), code splitting, lazy-loading des sections sous la ligne de flottaison

## Démarrage local

### 1. Prérequis

- Node.js ≥ 20

### 2. Variables d'environnement

Copie `.env.example` vers `.env` et remplis avec tes clés Supabase :

```bash
cp .env.example .env
```

> Les clés réelles **ne sont jamais committées** (`.env` est dans `.gitignore`).
> Elles sont fournies via les variables d'environnement Vercel en production.

### 3. Installer & lancer

```bash
npm install
npm run dev
```

Le site est servi sur `http://localhost:5173`.

### 4. Build de production

```bash
npm run build
npm run preview
```

## Scripts utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de dev |
| `npm run build` | Build de production |
| `npm run images:webp:dry` | Simulation de la conversion WebP (ne touche à rien) |
| `npm run images:webp` | Convertit les images du Storage en WebP (nécessite `SUPABASE_SERVICE_KEY`) |

## Base de données (Supabase)

Les scripts SQL sont dans `supabase/`, à exécuter **dans l'ordre** via SQL Editor :

| Fichier | Rôle |
|---|---|
| `01-securite-rls.sql` | Active RLS sur toutes les tables + crée `track_order` et la colonne `qc_photos` |
| `02-admin-auth.sql` | Procédure de migration du mot de passe admin vers Supabase Auth |
| `03-purge-policies.sql` | Purge toutes les policies puis recrée uniquement les bonnes |
| `04-nettoyage-tests.sql` | Efface les lignes de test de l'audit |
| `05-confirmer-admin.sql` | Confirme le compte admin si l'email n'est pas validé |
| `06-nettoyer-catalogue.sql` | Nettoyage du catalogue |
| `07-chat-realtime-delete.sql` | Active les événements DELETE en temps réel pour le chat |
| `08-description-produit.sql` | Colonne description produit |
| `09` / `10` | Suppression des commandes de test |
| `11-corrections-textes.sql` | Corrige les fautes d'orthographe dans le contenu en base |

## Sécurité

- Données clients protégées par **RLS** : lecture des commandes réservée à l'admin connecté, chacun ne voit que sa conversation chat, codes promo validés par fonction (jamais lus directement).
- Le suivi de commande expose **uniquement** le statut + un indice de ville (`Ly•••`), jamais le nom / téléphone / adresse.
- Admin protégé par **Supabase Auth** (mot de passe hashé). Pense à désactiver « Enable Sign Up » dans Authentication → Providers → Email.

## Licence

Projet privé.
