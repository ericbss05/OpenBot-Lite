# OpenBot Server Lite

Version **allégée et fiable** du serveur OpenBot (`server/`), avec les **mêmes concepts** :

| Concept (server complet) | Lite |
|--------------------------|------|
| API Hono + `/health`, `/api/capabilities` | Oui |
| Mode mono-utilisateur (`OPENBOT_SINGLE_USER`) | `LITE_API_KEY` + utilisateur dev fixe |
| Coworkers / profils agents AG-UI | SQLite + `agents.yaml` |
| Canaux + historique durable | Messages en base (pas CopilotKit Intelligence) |
| Passerelle politique CEL + audit | `/api/gateway/decide`, `/api/admin/boundaries` |
| File de travail + exécution des tours | Polling SQLite (pas `pg_notify`) |
| Routines planifiées | Cron simplifié |
| Plugins MCP | Stdio MCP uniquement (pas Composio) |
| Ordinateur / supervisor / voix / SSO / learning | **Non** (hors scope Lite) |

## Prérequis

- [Bun](https://bun.sh) 1.1+
- Un endpoint **AG-UI** (ex. un bot d’exemple OpenBot) joignable depuis cette machine

## Démarrage

```sh
cd server-lite
cp .env.example .env
cp agents.example.yaml agents.yaml   # puis éditez l’endpoint
bun install
bun run dev
```

Authentification : en-tête `Authorization: Bearer <LITE_API_KEY>` sur toutes les routes `/api/*`.

## Exemple de flux

```sh
export AUTH="Authorization: Bearer dev-change-me"

# Créer un canal
curl -s -H "$AUTH" -H 'content-type: application/json' \
  -d '{"name":"Demo","agentIds":["general"]}' \
  http://127.0.0.1:3101/api/channels

# Envoyer un message (tour agent mis en file)
curl -s -H "$AUTH" -H 'content-type: application/json' \
  -d '{"content":"Bonjour"}' \
  http://127.0.0.1:3101/api/channels/<CHANNEL_ID>/messages

# Lire l’historique
curl -s -H "$AUTH" http://127.0.0.1:3101/api/channels/<CHANNEL_ID>/messages
```

## Limites assumées

- **Pas de parité API** avec le server complet : seules les routes ci-dessus sont implémentées.
- **Un processus** : pas de réplication multi-replica comme avec PostgreSQL + `SKIP LOCKED`.
- **Client AG-UI minimal** : POST JSON `{ threadId, messages }` ; adaptez `ag-ui-client.ts` si votre endpoint attend un autre contrat.
- **Production** : possible pour prototypes internes ; pour gouvernance entreprise complète, rester sur `server/`.

## Tests

```sh
bun test
```
