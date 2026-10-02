import type { Agent } from "./agent";
import type {
  LLMMessage,
  LLMProvider,
  LLMToolCall,
} from "./llm/provider";
import type { ToolRegistry } from "./tools/tools";
import type { AgentRuntime } from "./runtime/runtime";
import { RuntimeHistory } from "./runtime/history";

export type ConversationStatus =
  | "completed"
  | "waiting"
  | "failed";

export interface ConversationResult {
  status: ConversationStatus;
  runId: string;
  content?: string;
  error?: string;
  pendingApprovalId?: string;
  pendingToolCall?: LLMToolCall;
}

export class AgentConversation {
  constructor(
    private readonly llm: LLMProvider,
    private readonly tools: ToolRegistry,
    private readonly runtime: AgentRuntime,
    private readonly maxTurns = 10,
  ) {}

  async run(
    agent: Agent,
    messages: LLMMessage[],
  ): Promise<ConversationResult> {
    if (messages.length === 0) {
      throw new Error(
        "Cannot run conversation without messages.",
      );
    }

    const history = new RuntimeHistory([
      ...messages,
    ]);

    const runId = crypto.randomUUID();

    for (
      let turn = 0;
      turn < this.maxTurns;
      turn += 1
    ) {
      console.log(
        "[AGENT] generating response...",
      );

      const response =
        await this.llm.generate({
          agent,
          messages:
            history.getMessages(),
          tools: this.tools.list(
            agent.tools,
          ),
        });

      console.log(
        "[AGENT] LLM response:",
        response,
      );

      if (response.type === "text") {
        history.addAssistantMessage(
          response.content,
        );

        return {
          status: "completed",
          runId,
          content: response.content,
        };
      }

      history.addAssistantToolCalls(
        response.calls,
      );

      for (const call of response.calls) {
        console.log(
          "[AGENT] tool requested:",
          {
            toolId: call.toolId,
            arguments: call.arguments,
          },
        );

        const execution =
  await this.runtime.executeTool(
    runId,
    agent.id,
    call,
  );

        if (
          execution.status ===
          "approval_required"
        ) {
          return {
            status: "waiting",
            runId,
            pendingApprovalId:
              execution.approvalId,
            pendingToolCall: call,
          };
        }

        if (
          execution.status ===
          "denied"
        ) {
          history.addToolResult(
            call.id,
            {
              error:
                execution.reason ??
                "Tool execution denied by Gateway.",
            },
          );

          continue;
        }

        if (!execution.result) {
          history.addToolResult(
            call.id,
            {
              error:
                "Tool execution returned no result.",
            },
          );

          continue;
        }

        const toolResult =
          execution.result;

        const content =
          toolResult.status ===
          "success"
            ? toolResult.output
            : {
                error:
                  toolResult.error,
              };

        history.addToolResult(
          call.id,
          content,
        );
      }
    }

    return {
      status: "failed",
      runId,
      error:
        `Maximum conversation turns exceeded: ${this.maxTurns}`,
    };
  }
}