# 04 — Module `channels/`

Fichier couvert : `src/channels/store.ts` (96 l.).

## Rôle
Représenter les **conversations** : un canal a un nom, un `threadId` (identifiant du fil transmis à l'agent), une liste d'agents, et un historique de messages persistant. C'est l'équivalent Lite des canaux + threads durables (dans le serveur complet, l'historique est délégué à CopilotKit Intelligence).

## Type `Channel`
`{ id, name, threadId, agentIds: string[], active: boolean, lastMessageAt: Date|null, createdAt: Date }`

`agentIds` est stocké en JSON dans la base et **désérialisé** par `mapChannel`.

## Méthodes de `createChannelStore(db)`

| Méthode | Description |
|---------|-------------|
| `create({name, agentIds})` | Génère `id` et `threadId` (UUID), `active=true`, `lastMessageAt=null` |
| `list()` | Tous les canaux triés par `lastMessageAt` décroissant (les canaux sans message en dernier) |
| `get(id)` | Un canal ou `null` |
| `appendMessage({channelId, role, content, agentId?})` | Insère le message et met à jour `channels.last_message_at` ; retourne `{id, createdAt}` |
| `history(channelId, limit = 100)` | Messages du canal, triés par `created_at` **croissant**, limités à `limit` |

## Utilisateurs du module
- `app.ts` : création, liste, historique, ajout du message utilisateur.
- `work/runner.ts` : lecture de l'historique (`limit=40`) + ajout de la réponse de l'agent.
- `routines/runner.ts` : ajout du prompt de routine comme message `user`.

## ⚠ Point d'attention majeur (vérifié)
`history()` fait `ORDER BY created_at ASC LIMIT n` : il renvoie les **n plus anciens** messages, pas les n derniers.

Test reproduit avec 60 messages : `history(channel, 40)` retourne `msg-1 … msg-40`, alors que le dernier message réel est `msg-60`.

Conséquences :
- Au-delà de 40 messages, l'agent reçoit toujours les 40 **premiers** : il ne voit plus la question qui vient d'être posée.
- `GET /api/channels/:id/messages` ne montre jamais au-delà des 100 premiers messages.

Correctif typique : trier en `DESC`, limiter, puis inverser le tableau (ou sous-requête).

## Autres remarques
- Les `agentIds` ne sont pas validés (un canal peut référencer des agents inexistants).
- Le champ `active` n'a aucun effet.
- Pas d'index `(channel_id, created_at)`.
- Deux messages créés dans la même milliseconde ont un ordre non garanti.
