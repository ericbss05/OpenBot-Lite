# 01 — Démarrage, configuration, API HTTP et authentification

Fichiers couverts : `src/index.ts` (53 l.), `src/config.ts` (25 l.), `src/app.ts` (224 l.), `src/auth/guards.ts` (28 l.).

---

## 1. `src/index.ts` — point d'entrée / composition root

### Rôle
Assembler tous les modules (injection de dépendances « à la main ») et démarrer les trois boucles : HTTP, exécuteur de tours, routines.

### Composition
Séquence linéaire, en *top-level await* :

| Étape | Code | Effet |
|-------|------|-------|
| 1 | `loadConfig()` | Valide `process.env` ; lève une erreur si invalide |
| 2 | `createDatabase()` + `migrate()` | Ouvre SQLite, crée les tables |
| 3 | `createAgentStore()` + `syncFromYaml("agents.yaml")` | Charge les agents du YAML (chemin **relatif au cwd**) |
| 4 | `createChannelStore`, `createAuditStore` | Stores simples |
| 5 | `createGateway()` + `await gateway.start()` | Hydrate la politique depuis la base |
| 6 | `createWorkQueue`, `createRoutineStore`, `createPluginStore` | |
| 7 | `createTurnRunner(...).start()` | Lance la boucle de polling |
| 8 | `createRoutineRunner(...).start()` | Lance le tick cron |
| 9 | `createApp({...})` puis `serve({ fetch: app.fetch, port })` | Démarre Bun.serve |

### Points d'attention
- Les méthodes `stop()` des runners existent mais **ne sont jamais appelées** (pas de gestion de `SIGINT`/`SIGTERM`).
- Le log affiche `http://127.0.0.1:<port>` mais `serve()` est appelé **sans `hostname`** : à ma connaissance Bun écoute alors sur toutes les interfaces (`0.0.0.0`). À vérifier dans votre environnement ; ajouter `hostname: "127.0.0.1"` si l'intention est locale.

---

## 2. `src/config.ts` — configuration typée

### Rôle
Valider les variables d'environnement au démarrage (*fail-fast*) avec Zod et exposer un objet `LiteConfig`.

### Variables

| Variable | Type / défaut | Usage |
|----------|---------------|-------|
| `PORT` | nombre, `3101` | Port HTTP (évite de heurter le serveur complet sur 3001) |
| `DATABASE_PATH` | string, `./data/openbot-lite.sqlite` | Fichier SQLite (dossier créé automatiquement) |
| `LITE_API_KEY` | string, **min 8 caractères**, obligatoire | Clé du Bearer token |
| `ALLOW_PRIVATE_HOSTS` | `true/false/1/0`, défaut **`true`** | Autorise les endpoints d'agents sur réseau privé/localhost |
| `ACTION_POLICY_MODE` | `enforce` \| `dry-run`, défaut `enforce` | Mode **initial** de la politique (voir §gateway) |

`LiteConfig = z.infer<typeof envSchema> & { singleUser: true }` : le flag `singleUser` est **codé en dur** à `true` (pas de mode multi-utilisateur).

### Comportement
En cas d'erreur, le message liste uniquement les **noms** des variables fautives (jamais les valeurs) et invite à copier `.env.example`.

> Les scripts `dev`/`start` passent `--env-file=.env` à Bun : le fichier `.env` est lu par Bun, pas par le code.

---

## 3. `src/app.ts` — application Hono

### Rôle
Définir **toutes les routes HTTP**. `createApp(deps)` reçoit les stores par injection et retourne l'instance Hono ; la logique métier reste dans les stores, `app.ts` fait : validation Zod → appel store → audit → réponse.

### Routes

#### Publiques (sans authentification)

| Méthode | Chemin | Réponse |
|---------|--------|---------|
| GET | `/health` | `{status:"ok"}` |
| GET | `/api/capabilities` | `{mode:"lite", durableHistory:true, generativeUi:false, transcription:false, voice:false, authProviders:[], ssoConfigured:false, singleUser:true}` — déclaré **avant** le `app.use("/api/*", auth)` |

#### Protégées (`Authorization: Bearer <LITE_API_KEY>`)

| Méthode | Chemin | Corps attendu | Action | Audit |
|---------|--------|---------------|--------|-------|
| GET | `/api/me` | — | Retourne l'utilisateur fixe | — |
| GET | `/api/agents` | — | Liste des agents | — |
| POST | `/api/agents` | `{name,title,roleDescription,visibility,endpoint}` | Crée un agent (endpoint vérifié) ; 400 si invalide | `agent.created` |
| GET | `/api/channels` | — | Liste des canaux (plus récent d'abord) | — |
| POST | `/api/channels` | `{name, agentIds[≥1]}` | Crée un canal | `channel.created` |
| GET | `/api/channels/:id/messages` | — | Historique (100 max) | — |
| POST | `/api/channels/:id/messages` | `{content, agentId?}` | Enregistre le message user, met un tour en file ; **202** `{queued:true}` | *(à la réponse de l'agent)* |
| GET | `/api/admin/audit-events` | — | 100 derniers événements | — |
| GET | `/api/admin/boundaries` | — | Politique courante | — |
| PUT | `/api/admin/boundaries` | `{mode,deny[],allow[]}` | Remplace la politique | `configuration.changed` |
| POST | `/api/gateway/decide` | `{tool:{name}, bot:{id}, page?:{url,host}}` | Évalue une action ; **403** si refusée en `enforce` | `gateway.decided` |
| GET | `/api/routines` | — | Liste | — |
| POST | `/api/routines` | `{name,cron,channelId,agentId,prompt}` | Crée une routine | `routine.created` |
| GET | `/api/plugins` | — | Liste des serveurs MCP | — |
| POST | `/api/plugins` | `{name,command,args[]}` | Enregistre un serveur MCP stdio | `plugin.registered` |
| GET | `/api/plugins/:id/tools` | — | Liste les outils du serveur MCP (spawn d'un process) | — |
| POST | `/api/plugins/:id/call` | `{tool, arguments, botId}` | Évalue la politique puis appelle l'outil | `plugin.tool_called` |

### Détail du flux d'envoi de message (`app.ts:89-114`)
1. Valide `{content, agentId?}`.
2. Vérifie que le canal existe (404 sinon).
3. `agentId = body.agentId ?? channel.agentIds[0]` ; 400 si aucun agent.
4. `channels.appendMessage(role:"user")`.
5. `queue.offer("channel.turn", "<channelId>:<Date.now()>", {channelId, agentId, actorId})`.
6. Répond `202 {queued:true}`.

### Points d'attention (vérifiés à l'exécution)
- **Pas de `app.onError`** : un corps invalide (Zod) ou un JSON malformé provoque une **HTTP 500** au lieu d'un 400.
- `agentId` fourni dans le corps n'est **pas** vérifié contre `channel.agentIds` ni contre la table des agents.
- `GET /api/channels/:id/messages` ne vérifie pas l'existence du canal (renvoie `[]`).
- Aucune route de suppression/modification (agents, canaux, routines, plugins) ; `RoutineStore.setEnabled` n'est exposé par aucune route.

---

## 4. `src/auth/guards.ts` — authentification

### Rôle
Protéger `/api/*` par une clé partagée et injecter un utilisateur unique dans le contexte Hono.

### Composition

| Élément | Description |
|---------|-------------|
| `DEV_USER` | `{ id:"lite-dev-user", name:"Administrator", role:"admin" }` |
| `AppVariables` | Type des variables de contexte Hono : `{ user: typeof DEV_USER }` |
| `createAuthMiddleware(config)` | Compare l'en-tête `authorization` à `Bearer ${LITE_API_KEY}` ; 401 sinon ; puis `c.set("user", DEV_USER)` |
| `requireUser(c)` | Lit l'utilisateur du contexte (ne lève pas d'erreur s'il manque) |

### Points d'attention
- Comparaison par `!==` (non constante en temps) — risque théorique de *timing attack*, faible en pratique mais trivial à corriger (`crypto.timingSafeEqual`).
- Un seul rôle (`admin`) : **aucune séparation** lecteur/administrateur ; toute personne ayant la clé peut modifier la politique, enregistrer des plugins, etc.
- Pas de limitation de tentatives (rate limiting).
