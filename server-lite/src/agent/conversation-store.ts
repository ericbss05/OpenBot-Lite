import type { ConversationState } from "./conversation";

export interface ConversationStore {
set(runId: string, state: ConversationState): void;
get(runId: string): ConversationState | undefined;
delete(runId: string): void;
}

export function createConversationStore(): ConversationStore {
const conversations = new Map<
string,
ConversationState

> ();

return {
set(runId, state) {
conversations.set(runId, state);
},


get(runId) {
  return conversations.get(runId);
},

delete(runId) {
  conversations.delete(runId);
},

};
}
