/**
 * Test : interruption d'un agent sur une action sensible,
 * approbation, reprise et exécution.
 *
 * Lancer :
 *   bun run src/agent/tests/approvals.ts
 */

import type { Agent } from "../agent";
import { OpenAIProvider } from "../llm/openai";
import { AgentRuntime } from "../runtime/runtime";
import { ToolRegistry } from "../tools/tools";

import type {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalStore,
} from "../approvals/approvals";

import { currentTimeTool } from "../tools/internal/current-time";
import { textAnalyzerTool } from "../tools/internal/text-analyzer";
import { searchMemoryTool } from "../tools/internal/search-memory";
import { createSubAgentTool } from "../tools/internal/create-sub-agent";

import { createTestGateway } from "./helpers/test-gateway";

// ---------------------------------------------------------------------------
// In-memory approval store
// ---------------------------------------------------------------------------

class InMemoryApprovalStore
  implements ApprovalStore
{
  private readonly requests =
    new Map<
      string,
      ApprovalRequest
    >();

  private readonly decisions =
    new Map<
      string,
      ApprovalDecision
    >();

  async create(
    request: ApprovalRequest,
  ): Promise<void> {
    this.requests.set(
      request.id,
      request,
    );
  }

  async decide(
    approvalId: string,
    decision: ApprovalDecision,
  ): Promise<void> {
    if (
      !this.requests.has(
        approvalId,
      )
    ) {
      throw new Error(
        `Approval not found: ${approvalId}`,
      );
    }

    this.decisions.set(
      approvalId,
      decision,
    );
  }

  async getDecision(
    approvalId: string,
  ): Promise<
    ApprovalDecision | null
  > {
    return (
      this.decisions.get(
        approvalId,
      ) ?? null
    );
  }

  getRequest(
    approvalId: string,
  ): ApprovalRequest | undefined {
    return this.requests.get(
      approvalId,
    );
  }
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

function buildRegistry(): ToolRegistry {
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

  return registry;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

function buildAgent(): Agent {
  return {
    id: "approval-test-agent",

    name:
      "Approval Test Agent",

    model:
      process.env.TEST_MODEL ??
      process.env.OPENAI_MODEL ??
      "gpt-6-luna",

    instructions: `
Tu es un agent capable d'utiliser des outils.

Tu dois accomplir entièrement la mission.

Lorsqu'une action nécessite une approbation,
le système interrompra temporairement ton exécution.

Une fois l'action approuvée, continue la mission
et exécute l'action.

Ne demande jamais à l'utilisateur de réaliser
l'action lui-même.

Après l'exécution des outils nécessaires,
donne une réponse finale claire.
    `.trim(),

    tools: [
      "current_time",
      "text_analyzer",
      "search_memory",
      "create_sub_agent",
    ],

    subAgents: [],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(
    "\n============================================================",
  );

  console.log(
    "  TEST AGENT — APPROVAL / RESUME",
  );

  console.log(
    "============================================================\n",
  );

  const registry =
    buildRegistry();

  const approvals =
    new InMemoryApprovalStore();

  const gateway =
    createTestGateway(
      registry,
    );

  let llm: OpenAIProvider;

  try {
    llm = new OpenAIProvider();
  } catch (error) {
    console.error(
      `❌ ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );

    console.error(
      "   Vérifie OPENAI_API_KEY.",
    );

    process.exit(1);
  }

  const runtime =
    new AgentRuntime(
      {
        llm,
        tools: registry,
        approvals,
        gateway,
      },
      10,
    );

  const agent =
    buildAgent();

  const mission = `
Crée un sous-agent spécialisé dans l'analyse de textes.

Le sous-agent doit avoir :

- le nom "Text Analyst"
- le rôle "Analyse les textes et fournit des statistiques."

Utilise les outils disponibles pour accomplir cette mission.

Une fois le sous-agent créé, donne-moi un résumé clair
de ce qui a été créé.

Ne me demande pas de réaliser l'action à ta place.
  `.trim();

  console.log(
    `Modèle       : ${agent.model}`,
  );

  console.log(
    `Outils       : ${agent.tools.join(", ")}`,
  );

  console.log(
    "\nMission :\n",
  );

  console.log(mission);

  console.log(
    "\n------------------------------------------------------------",
  );

  // -------------------------------------------------------------------------
  // 1. Run initial
  // -------------------------------------------------------------------------

  console.log(
    "\n▶ Run initial...\n",
  );

  const initialState =
    await runtime.run(
      agent,
      mission,
    );

  console.log(
    `Status       : ${initialState.status}`,
  );

  console.log(
    `Turn         : ${initialState.turn}`,
  );

  console.log(
    `Messages     : ${initialState.messages.length}`,
  );

  console.log(
    `Tool calls   : ${initialState.toolResults.length}`,
  );

  console.log(
    `Approval ID  : ${
      initialState.pendingApprovalId ??
      "aucun"
    }`,
  );

  console.log(
    `Pending tool : ${
      initialState.pendingToolCall
        ?.toolId ??
      "aucun"
    }`,
  );

  // -------------------------------------------------------------------------
  // 2. Vérifier l'interruption
  // -------------------------------------------------------------------------

  if (
    initialState.status !==
    "waiting"
  ) {
    console.log(
      "\n❌ Échec : le runtime devait être en attente d'approbation.",
    );

    if (
      initialState.error
    ) {
      console.log(
        `Erreur       : ${initialState.error}`,
      );
    }

    process.exit(1);
  }

  if (
    !initialState.pendingApprovalId
  ) {
    console.log(
      "\n❌ Échec : aucun pendingApprovalId.",
    );

    process.exit(1);
  }

  if (
    !initialState.pendingToolCall
  ) {
    console.log(
      "\n❌ Échec : aucun pendingToolCall.",
    );

    process.exit(1);
  }

  if (
    initialState.pendingToolCall
      .toolId !==
    "create_sub_agent"
  ) {
    console.log(
      `\n❌ Échec : mauvais tool en attente : ${initialState.pendingToolCall.toolId}`,
    );

    process.exit(1);
  }

  const approvalId =
    initialState.pendingApprovalId;

  const approval =
    approvals.getRequest(
      approvalId,
    );

  if (!approval) {
    console.log(
      "\n❌ Échec : la demande d'approbation n'a pas été enregistrée.",
    );

    process.exit(1);
  }

  console.log(
    "\n✅ Approval correctement demandé.",
  );

  console.log(
    `   Tool        : ${approval.toolId}`,
  );

  console.log(
    `   Call ID     : ${approval.toolCallId}`,
  );

  console.log(
    `   Approval ID : ${approval.id}`,
  );

  console.log(
    `   Arguments   : ${JSON.stringify(
      approval.arguments,
    )}`,
  );

  // -------------------------------------------------------------------------
  // 3. Approuver
  // -------------------------------------------------------------------------

  console.log(
    "\n▶ Approbation de l'action...\n",
  );

  await approvals.decide(
    approvalId,
    "approved",
  );

  console.log(
    "✅ Approbation enregistrée.",
  );

  // -------------------------------------------------------------------------
  // 4. Resume
  // -------------------------------------------------------------------------

  console.log(
    "\n▶ Resume du runtime...\n",
  );

  const finalState =
    await runtime.resume(
      initialState,
      "approved",
    );

  // -------------------------------------------------------------------------
  // 5. Résultat
  // -------------------------------------------------------------------------

  console.log(
    `Status       : ${finalState.status}`,
  );

  console.log(
    `Turn         : ${finalState.turn}`,
  );

  console.log(
    `Messages     : ${finalState.messages.length}`,
  );

  console.log(
    `Tool calls   : ${finalState.toolResults.length}`,
  );

  console.log(
    `Pending tool : ${
      finalState.pendingToolCall
        ?.toolId ??
      "aucun"
    }`,
  );

  console.log(
    `Approval ID  : ${
      finalState.pendingApprovalId ??
      "aucun"
    }`,
  );

  if (
    finalState.error
  ) {
    console.log(
      `Erreur       : ${finalState.error}`,
    );
  }

  // -------------------------------------------------------------------------
  // 6. Assertions
  // -------------------------------------------------------------------------

  if (
    finalState.status !==
    "completed"
  ) {
    console.log(
      "\n❌ Test échoué : le run n'est pas terminé.",
    );

    process.exit(1);
  }

  const createdTool =
    finalState.toolResults.find(
      (result) =>
        result.toolId ===
        "create_sub_agent",
    );

  if (!createdTool) {
    console.log(
      "\n❌ Test échoué : create_sub_agent n'a pas été exécuté.",
    );

    process.exit(1);
  }

  if (
    createdTool.status !==
    "success"
  ) {
    console.log(
      "\n❌ Test échoué : create_sub_agent n'a pas réussi.",
    );

    console.log(
      `Erreur : ${createdTool.error ?? "inconnue"}`,
    );

    process.exit(1);
  }

  if (
    finalState.pendingToolCall
  ) {
    console.log(
      "\n❌ Test échoué : pendingToolCall devrait être vide.",
    );

    process.exit(1);
  }

  if (
    finalState.pendingApprovalId
  ) {
    console.log(
      "\n❌ Test échoué : pendingApprovalId devrait être vide.",
    );

    process.exit(1);
  }

  const decision =
    await approvals.getDecision(
      approvalId,
    );

  if (
    decision !== "approved"
  ) {
    console.log(
      "\n❌ Test échoué : l'approbation n'est pas enregistrée comme approved.",
    );

    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Success
  // -------------------------------------------------------------------------

  console.log(
    "\n------------------------------------------------------------",
  );

  console.log(
    "\n✅ TEST APPROVAL RÉUSSI",
  );

  console.log(
    "   tool call",
  );

  console.log(
    "      ↓",
  );

  console.log(
    "   Gateway",
  );

  console.log(
    "      ↓",
  );

  console.log(
    "   approval_required",
  );

  console.log(
    "      ↓",
  );

  console.log(
    "   ApprovalStore",
  );

  console.log(
    "      ↓",
  );

  console.log(
    "   approved",
  );

  console.log(
    "      ↓",
  );

  console.log(
    "   resume",
  );

  console.log(
    "      ↓",
  );

  console.log(
    "   tool execution",
  );

  console.log(
    "      ↓",
  );

  console.log(
    "   completed",
  );

  console.log(
    "\n============================================================\n",
  );
}

main().catch(
  (error) => {
    console.error(
      "\n❌ Erreur inattendue :",
    );

    console.error(error);

    process.exit(1);
  },
);
