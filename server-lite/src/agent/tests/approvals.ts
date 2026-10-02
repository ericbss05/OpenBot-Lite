import { db } from "../../db";

import type {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalStore,
} from "../approvals/approvals";

import { createAgentStore } from "../store";
import { OpenAIProvider } from "../llm/openai";
import { AgentRuntime } from "../runtime/runtime";
import { ToolRegistry } from "../tools/tools";

import { currentTimeTool } from "../tools/internal/current-time";
import { textAnalyzerTool } from "../tools/internal/text-analyzer";
import { searchMemoryTool } from "../tools/internal/search-memory";
import { createSubAgentTool } from "../tools/internal/create-sub-agent";

import { createTestGateway } from "./helpers/test-gateway";

const AGENT_ID =
  process.env.TEST_AGENT_ID ?? "test-agent";

class InMemoryApprovalStore
  implements ApprovalStore
{
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
    this.decisions.set(approvalId, decision);
  }

  async getDecision(
    approvalId: string,
  ): Promise<ApprovalDecision | null> {
    return this.decisions.get(approvalId) ?? null;
  }

  getRequest(
    approvalId: string,
  ): ApprovalRequest | undefined {
    return this.requests.get(approvalId);
  }
}

function buildRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(currentTimeTool);
  registry.register(textAnalyzerTool);
  registry.register(searchMemoryTool);
  registry.register(createSubAgentTool);

  return registry;
}

async function main(): Promise<void> {
  const agentStore = createAgentStore(db);
  const agent = await agentStore.get(AGENT_ID);

  if (!agent) {
    throw new Error(
      `Agent "${AGENT_ID}" introuvable dans PostgreSQL.`,
    );
  }

  console.log("\nAgent :", agent.id);
  console.log("Tools depuis AgentStore :", agent.tools);

  const registry = buildRegistry();
  const gateway = createTestGateway(registry);
  const approvals = new InMemoryApprovalStore();

  const llm = new OpenAIProvider();

  const runtime = new AgentRuntime(
    {
      llm,
      tools: registry,
      approvals,
      gateway,
      agents: agentStore,
    },
    10,
  );

  const mission = `
Crée un sous-agent spécialisé dans l'analyse de textes.

Nom : "Text Analyst"

Rôle : "Analyse les textes et fournit des statistiques."

Utilise les outils disponibles pour accomplir cette mission.
`.trim();

  const initialState = await runtime.run(
    AGENT_ID,
    [
      {
        role: "user",
        content: mission,
      },
    ],
  );

  console.log(
    "\nInitial :",
    initialState.status,
    initialState.pendingToolCall?.toolId ?? "aucun",
  );

  if (
    initialState.status !== "waiting" ||
    !initialState.pendingApprovalId
  ) {
    throw new Error(
      "Le runtime n'est pas en attente d'approbation.",
    );
  }

  const approvalId =
    initialState.pendingApprovalId;

  const approval =
    approvals.getRequest(approvalId);

  if (!approval) {
    throw new Error(
      "Demande d'approbation introuvable.",
    );
  }

  console.log(
    "Approval :",
    approval.toolId,
    approval.arguments,
  );

  await approvals.decide(
    approvalId,
    "approved",
  );

  const finalState = await runtime.resume(
    initialState,
    "approved",
  );

  console.log(
    "Final :",
    finalState.status,
  );

  if (finalState.status !== "completed") {
    throw new Error(
      finalState.error ??
        "Le runtime n'est pas terminé.",
    );
  }

  const result =
    finalState.toolResults.find(
      (toolResult) =>
        toolResult.toolId ===
        "create_sub_agent",
    );

  if (
    !result ||
    result.status !== "success"
  ) {
    throw new Error(
      "create_sub_agent n'a pas été exécuté correctement.",
    );
  }

  console.log(
    "\n✅ Test approval réussi.",
  );
}

main().catch((error) => {
  console.error(
    "\n❌",
    error instanceof Error
      ? error.message
      : error,
  );

  process.exit(1);
});