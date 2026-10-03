import { db } from "../../db";

import { createAgentStore } from "../store";
import { OpenAIProvider } from "../llm/openai";
import { AgentRuntime } from "../runtime/runtime";
import { ToolRegistry } from "../tools/tools";

import { currentTimeTool } from "../tools/internal/current-time";
import { textAnalyzerTool } from "../tools/internal/text-analyzer";
import { searchMemoryTool } from "../tools/internal/search-memory";
import { createSubAgentTool } from "../tools/internal/create-sub-agent";
import type { RunContext } from "../events/events";

import { createPostgresApprovalStore } from "../approvals/postgres-store";

import { createTestGateway } from "./helpers/test-gateway";

const AGENT_ID =
  process.env.TEST_AGENT_ID ?? "test-agent";

async function createRuntime(): Promise<AgentRuntime> {
  const agentStore =
    createAgentStore(db);

  const registry =
    new ToolRegistry();

  registry.register(
    currentTimeTool,
  );

  registry.register(
    textAnalyzerTool,
  );

  registry.register(
    searchMemoryTool,
  );

  registry.register(
    createSubAgentTool,
  );

  const gateway =
    createTestGateway(
      registry,
    );

  const approvals =
    createPostgresApprovalStore(
      db,
    );

  const llm =
    new OpenAIProvider();

  return new AgentRuntime(
    {
      llm,
      tools: registry,
      approvals,
      gateway,
      agents: agentStore,
      actorId: "test-user",
    },
    10,
  );
}

async function testApprovalApproved(): Promise<void> {
  console.log(
    "\n========================================",
  );
  console.log(
    "TEST 1 — APPROVAL APPROVED",
  );
  console.log(
    "========================================\n",
  );

  const runtime =
    await createRuntime();

  const mission = `
Crée un sous-agent spécialisé dans l'analyse de textes.

Nom : "Text Analyst"

Rôle : "Analyse les textes et fournit des statistiques."

Utilise les outils disponibles pour accomplir cette mission.
`.trim();

  console.log(
    "Lancement du runtime...\n",
  );

  const context: RunContext = {
  runId: crypto.randomUUID(),
  agentId: AGENT_ID,
  actorId: "test-user",
};

const state =
  await runtime.run(
    context,
    [
      {
        role: "user",
        content: mission,
      },
    ],
  );

  console.log(
    "\nÉtat après runtime.run() :",
  );

  console.log(
    "Status :",
    state.status,
  );

  console.log(
    "Run ID :",
    state.runId,
  );

  console.log(
    "Approval ID :",
    state.pendingApprovalId ??
      "aucune",
  );

  console.log(
    "Pending tool :",
    state.pendingToolCall
      ?.toolId ??
      "aucun",
  );

  if (
    state.status !== "waiting"
  ) {
    throw new Error(
      `Le runtime devrait être en attente. Status reçu : ${state.status}`,
    );
  }

  if (
    !state.pendingApprovalId
  ) {
    throw new Error(
      "Aucune approval n'a été créée.",
    );
  }

  if (
    !state.pendingToolCall
  ) {
    throw new Error(
      "Aucun tool call en attente.",
    );
  }

  if (
    state.pendingToolCall.toolId !==
    "create_sub_agent"
  ) {
    throw new Error(
      `Tool inattendu : ${state.pendingToolCall.toolId}`,
    );
  }

  const approvalId =
    state.pendingApprovalId;

  console.log(
    "\n✅ Approval créée.",
  );

  console.log(
    "Approbation de l'action...\n",
  );

  const resumedState =
    await runtime.resume(
      state,
      "approved",
    );

  console.log(
    "État après runtime.resume(..., approved) :",
  );

  console.log(
    "Status :",
    resumedState.status,
  );

  console.log(
    "Pending approval :",
    resumedState.pendingApprovalId ??
      "aucune",
  );

  console.log(
    "Pending tool :",
    resumedState.pendingToolCall
      ?.toolId ??
      "aucun",
  );

  const approval =
    await createPostgresApprovalStore(
      db,
    ).get(approvalId);

  if (!approval) {
    throw new Error(
      "Approval introuvable après approbation.",
    );
  }

  if (
    approval.status !==
    "approved"
  ) {
    throw new Error(
      `L'approval devrait être approved. Status reçu : ${approval.status}`,
    );
  }

  if (
    resumedState.status ===
    "waiting"
  ) {
    throw new Error(
      "Le runtime est toujours en attente après approbation.",
    );
  }

  if (
    resumedState.pendingApprovalId
  ) {
    throw new Error(
      "pendingApprovalId devrait être supprimé après approbation.",
    );
  }

  if (
    resumedState.pendingToolCall
  ) {
    throw new Error(
      "pendingToolCall devrait être supprimé après approbation.",
    );
  }

  const executed =
    resumedState.toolResults.some(
      (result) =>
        result.toolId ===
          "create_sub_agent" &&
        result.status ===
          "success",
    );

  if (!executed) {
    throw new Error(
      "Le tool create_sub_agent n'a pas été exécuté après approbation.",
    );
  }

  console.log(
    "\n✅ APPROVAL APPROVED : SUCCÈS",
  );

  console.log(
    "→ Approval enregistrée comme approved.",
  );

  console.log(
    "→ Tool exécuté.",
  );

  console.log(
    "→ Runtime sorti de l'état waiting.",
  );
}

async function testApprovalRejected(): Promise<void> {
  console.log(
    "\n========================================",
  );
  console.log(
    "TEST 2 — APPROVAL REJECTED",
  );
  console.log(
    "========================================\n",
  );

  const runtime =
    await createRuntime();

  const mission = `
Crée un sous-agent spécialisé dans l'analyse de textes.

Nom : "Rejected Agent"

Rôle : "Analyse les textes et fournit des statistiques."

Utilise les outils disponibles pour accomplir cette mission.
`.trim();

  console.log(
    "Lancement du runtime...\n",
  );

  const context: RunContext = {
  runId: crypto.randomUUID(),
  agentId: AGENT_ID,
  actorId: "test-user",
};

const state =
  await runtime.run(
    context,
    [
      {
        role: "user",
        content: mission,
      },
    ],
  );

  console.log(
    "\nÉtat après runtime.run() :",
  );

  console.log(
    "Status :",
    state.status,
  );

  console.log(
    "Run ID :",
    state.runId,
  );

  console.log(
    "Approval ID :",
    state.pendingApprovalId ??
      "aucune",
  );

  console.log(
    "Pending tool :",
    state.pendingToolCall
      ?.toolId ??
      "aucun",
  );

  if (
    state.status !== "waiting"
  ) {
    throw new Error(
      `Le runtime devrait être en attente. Status reçu : ${state.status}`,
    );
  }

  if (
    !state.pendingApprovalId
  ) {
    throw new Error(
      "Aucune approval n'a été créée.",
    );
  }

  if (
    !state.pendingToolCall
  ) {
    throw new Error(
      "Aucun tool call en attente.",
    );
  }

  if (
    state.pendingToolCall.toolId !==
    "create_sub_agent"
  ) {
    throw new Error(
      `Tool inattendu : ${state.pendingToolCall.toolId}`,
    );
  }

  const approvalId =
    state.pendingApprovalId;

  console.log(
    "\n✅ Approval créée.",
  );

  console.log(
    "Rejet de l'action...\n",
  );

  const resumedState =
    await runtime.resume(
      state,
      "rejected",
    );

  console.log(
    "État après runtime.resume(..., rejected) :",
  );

  console.log(
    "Status :",
    resumedState.status,
  );

  console.log(
    "Error :",
    resumedState.error ??
      "aucune",
  );

  const approval =
    await createPostgresApprovalStore(
      db,
    ).get(approvalId);

  if (!approval) {
    throw new Error(
      "Approval introuvable après rejet.",
    );
  }

  if (
    approval.status !==
    "rejected"
  ) {
    throw new Error(
      `L'approval devrait être rejected. Status reçu : ${approval.status}`,
    );
  }

  if (
    resumedState.status !==
    "failed"
  ) {
    throw new Error(
      `Le runtime devrait être failed après rejet. Status reçu : ${resumedState.status}`,
    );
  }

  if (
    resumedState.toolResults.some(
      (result) =>
        result.toolId ===
          "create_sub_agent" &&
        result.status ===
          "success",
    )
  ) {
    throw new Error(
      "Le tool create_sub_agent ne doit PAS être exécuté après rejet.",
    );
  }

  if (
    resumedState.pendingApprovalId
  ) {
    throw new Error(
      "pendingApprovalId devrait être supprimé après rejet.",
    );
  }

  if (
    resumedState.pendingToolCall
  ) {
    throw new Error(
      "pendingToolCall devrait être supprimé après rejet.",
    );
  }

  console.log(
    "\n✅ APPROVAL REJECTED : SUCCÈS",
  );

  console.log(
    "→ Approval enregistrée comme rejected.",
  );

  console.log(
    "→ Tool non exécuté.",
  );

  console.log(
    "→ Runtime terminé en failed.",
  );
}

async function main(): Promise<void> {
  console.log(
    "\n========================================",
  );
  console.log(
    "       APPROVAL SYSTEM TEST SUITE",
  );
  console.log(
    "========================================\n",
  );

  const agentStore =
    createAgentStore(db);

  const agent =
    await agentStore.get(
      AGENT_ID,
    );

  if (!agent) {
    throw new Error(
      `Agent "${AGENT_ID}" introuvable dans PostgreSQL.`,
    );
  }

  console.log(
    "Agent :",
    agent.id,
  );

  console.log(
    "Tools depuis AgentStore :",
    agent.tools,
  );

  await testApprovalApproved();

  await testApprovalRejected();

  console.log(
    "\n========================================",
  );
  console.log(
    "✅ TOUS LES TESTS APPROVAL PASSENT",
  );
  console.log(
    "========================================\n",
  );
}

main().catch(
  (error) => {
    console.error(
      "\n❌ APPROVAL TEST FAILED\n",
      error,
    );

    process.exit(1);
  },
);