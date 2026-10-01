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

class InMemoryApprovalStore implements ApprovalStore {
  private readonly requests = new Map<
    string,
    ApprovalRequest
  >();

  private readonly decisions = new Map<
    string,
    ApprovalDecision
  >();

  async create(
    request: ApprovalRequest,
  ): Promise<void> {
    this.requests.set(request.id, request);
  }

  async decide(
    approvalId: string,
    decision: ApprovalDecision,
  ): Promise<void> {
    if (!this.requests.has(approvalId)) {
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
  ): Promise<ApprovalDecision | null> {
    return (
      this.decisions.get(approvalId) ??
      null
    );
  }

  getRequest(
    approvalId: string,
  ): ApprovalRequest | undefined {
    return this.requests.get(approvalId);
  }
}

const tools = new ToolRegistry();

tools.register(currentTimeTool);
tools.register(textAnalyzerTool);
tools.register(searchMemoryTool);
tools.register(createSubAgentTool);

const approvals =
  new InMemoryApprovalStore();

const llm = new OpenAIProvider();

const runtime = new AgentRuntime(
  {
    llm,
    tools,
    approvals,
  },
  10,
);


const agent = {
  id: "approval-test-agent",

  name: "Approval Test Agent",

  model:
    process.env.OPENAI_MODEL ??
    "gpt-6-luna",

  instructions: `
Tu es un agent capable d'utiliser des outils.

Tu dois accomplir entièrement la mission donnée.

Lorsqu'une action nécessite une approbation,
attends que le système te permette de continuer.

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

async function main() {
  console.log(
    "\n============================================================",
  );
  console.log(
    "  TEST AGENT — APPROVAL / RESUME",
  );
  console.log(
    "============================================================\n",
  );

  console.log(
    `Modèle       : ${agent.model}`,
  );

  console.log(
    "Outils       : current_time, text_analyzer, search_memory, create_sub_agent",
  );

  console.log(
    "\nMission :\n",
  );

  console.log(`
Crée un sous-agent spécialisé dans l'analyse de textes.

Le sous-agent doit avoir :
- le nom "Text Analyst"
- le rôle "Analyse les textes et fournit des statistiques."

Tu dois utiliser les outils disponibles pour accomplir
cette mission.

Une fois le sous-agent créé, donne-moi un résumé clair
de ce qui a été créé.

Ne me demande pas de réaliser l'action à ta place.
  `.trim());

  console.log(
    "\n------------------------------------------------------------\n",
  );

  // ----------------------------------------------------------
  // 1. Premier run
  // ----------------------------------------------------------

  console.log("▶ Run initial...\n");

  const initialState = await runtime.run(
    agent,
    `
Crée un sous-agent spécialisé dans l'analyse de textes.

Le sous-agent doit avoir :
- le nom "Text Analyst"
- le rôle "Analyse les textes et fournit des statistiques."

Utilise les outils disponibles pour accomplir cette mission.

Une fois le sous-agent créé, donne-moi un résumé clair.
    `.trim(),
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
      initialState.pendingToolCall?.toolId ??
      "aucun"
    }`,
  );

  // ----------------------------------------------------------
  // 2. Vérification de l'interruption
  // ----------------------------------------------------------

  if (initialState.status !== "waiting") {
    console.log(
      "\n❌ Échec : le runtime aurait dû être en attente d'approbation.",
    );

    if (initialState.error) {
      console.log(
        `Erreur       : ${initialState.error}`,
      );
    }

    process.exit(1);
  }

  if (!initialState.pendingApprovalId) {
    console.log(
      "\n❌ Échec : aucun pendingApprovalId.",
    );

    process.exit(1);
  }

  if (!initialState.pendingToolCall) {
    console.log(
      "\n❌ Échec : aucun pendingToolCall.",
    );

    process.exit(1);
  }

  if (
    initialState.pendingToolCall.toolId !==
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
    approvals.getRequest(approvalId);

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
    `   Tool       : ${approval.toolId}`,
  );

  console.log(
    `   Call ID    : ${approval.toolCallId}`,
  );

  console.log(
    `   Approval ID: ${approval.id}`,
  );

  // ----------------------------------------------------------
  // 3. Approbation
  // ----------------------------------------------------------

  console.log(
    "\n▶ Approbation de l'action...\n",
  );

  const finalState = await runtime.resume(
    initialState,
    "approved",
  );

  // ----------------------------------------------------------
  // 4. Vérification finale
  // ----------------------------------------------------------

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
      finalState.pendingToolCall?.toolId ??
      "aucun"
    }`,
  );

  if (finalState.error) {
    console.log(
      `Erreur       : ${finalState.error}`,
    );
  }

  console.log(
    "\n------------------------------------------------------------",
  );

  if (
    finalState.status !== "completed"
  ) {
    console.log(
      "\n❌ Test échoué : le run n'est pas terminé.",
    );

    process.exit(1);
  }

  if (
    finalState.toolResults.length < 1
  ) {
    console.log(
      "\n❌ Test échoué : aucun tool n'a été exécuté.",
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
    finalState.pendingToolCall
  ) {
    console.log(
      "\n❌ Test échoué : pendingToolCall devrait être vide après l'exécution.",
    );

    process.exit(1);
  }

  if (
    finalState.pendingApprovalId
  ) {
    console.log(
      "\n❌ Test échoué : pendingApprovalId devrait être vide après l'approbation.",
    );

    process.exit(1);
  }

  console.log(
    "\n✅ TEST APPROVAL RÉUSSI",
  );

  console.log(
    "   create_sub_agent → approval → resume → execution → completed",
  );

  console.log(
    "\n============================================================\n",
  );
}

main().catch((error) => {
  console.error(
    "\n❌ Erreur inattendue :",
  );

  console.error(error);

  process.exit(1);
});