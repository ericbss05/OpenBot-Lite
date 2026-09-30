# OpenBot Lite

Version simplifiée d'OpenBot, en **deux applications séparées** :

```
 Navigateur ──► web  (Next.js, :3000) ──/api/* (proxy)──► server (Hono, :3001) ──► PostgreSQL (Drizzle : Neon | PGlite)
                                                                          └────► Claude (ou faux modèle)
```

- **`server/`** : l'API Hono. Il porte toute la logique (droits, règlement, registre, agent) et **se teste seul**.
- **`web/`** : le frontend Next.js. Il n'a aucune logique métier ni aucun secret : il affiche et relaie.

Même principe que l'original : **le modèle propose, le server décide et trace.**

## Démarrer (zéro service)

```bash
# terminal 1 : le server
cd server && npm install && npm run dev        # http://localhost:3001

# terminal 2 : le frontend
cd web && npm install && npm run dev           # http://localhost:3000
```

Sans configuration : PostgreSQL en mémoire (PGlite) + faux modèle. Dans la conversation, essayez
`/time` ou `/fetch https://example.com`, puis l'onglet **Registre**.

## Tester le server sans le frontend

```bash
cd server
npm test        # 35 tests : logique, base Postgres réelle en mémoire, et toute l'API HTTP (sans ouvrir de port)
npm run bench   # mesure locale
```

Les tests HTTP utilisent `app.request()` de Hono et une injection de dépendances (`createApp({ db, provider, token })`) :
aucun réseau, aucune clé, aucun service.

## Production

```bash
# server
DATABASE_URL=postgres://...neon.tech/... npm run db:migrate      # migrations : toujours à part
ANTHROPIC_API_KEY=... OPENBOT_TOKEN=un-long-secret NODE_ENV=production npm start

# web  (⚠ OPENBOT_SERVER_URL est lue au BUILD, pas au démarrage)
OPENBOT_SERVER_URL=https://votre-server npm run build && npm start
```

## API du server

| Route | Rôle |
|---|---|
| `GET /api/health` | Publique. Vérifie la base. |
| `GET/POST /api/bots` | Lister / créer un Bot (les outils doivent exister). |
| `GET /api/conversations`, `GET /api/conversations/:id/messages` | Historique. |
| `POST /api/chat` | Conversation en **flux NDJSON** (`start`, `text`, `tool`, `tool_result`, `done`, `error`). |
| `GET /api/audit?limit=` | Le registre. |
| `GET/PUT /api/policy` | Règlement et mode (`enforce` / `dry-run`). |

Tout, sauf la santé, exige `Authorization: Bearer <OPENBOT_TOKEN>`.

## Ce que ça garde d'OpenBot

| Principe | Où |
|---|---|
| **Une seule porte** vers les outils : grant du Bot → règlement → registre *avant* d'agir → exécution → registre | `server/src/lib/gateway.ts` |
| Règlement : **deny gagne**, aucune règle = refus, règle illisible = refus, mode `dry-run` | `server/src/lib/policy.ts` |
| Registre **append-only imposé par Postgres** (triggers), valeurs sensibles masquées | `server/drizzle/0001_*.sql`, `server/src/lib/audit.ts` |
| Garde **anti-SSRF** (IP privées, métadonnées cloud, redirections re-contrôlées) | `server/src/lib/tools.ts` |
| Plafond de 6 tours d'outils ; modèle interchangeable | `agent.ts`, `model.ts` |

## Retiré volontairement

Intelligence (l'historique est en base), supervisor et ordinateurs de Bots, agents distants AG-UI, handoff, routines,
voix, compétences apprises, composants générés, SSO (remplacé par un jeton), coffre à secrets chiffré, temps réel
multi-utilisateurs, multi-réplicas, CEL (règles en JSON + regex).

## Limites connues

- **Un seul jeton partagé, pas de comptes** : tout le monde est admin.
- Le jeton est saisi dans le navigateur et gardé en `localStorage` : acceptable pour un outil interne, pas pour le public.
- **Coupure du client** : l'agent s'arrête, mais avec un morceau de retard (détectée à l'événement suivant) ; le signal
  d'annulation n'est pas encore transmis à l'appel Claude.
- `neon-http` n'a pas de transactions : remplacer le règlement = delete puis insert. Un échec à mi-chemin laisse le
  règlement vide, donc **tout est refusé** (jamais ouvert).
- Pas de limitation de débit ni de quotas.
- **Non exécutés ici** (ni clé, ni compte Neon) : l'appel réel à Claude (`AnthropicProvider`) et le driver Neon.
  Ils compilent et suivent la documentation des SDK, mais sont à essayer une première fois chez vous.
