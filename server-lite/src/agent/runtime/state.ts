import type { Agent } from "../agent";
import type { LLMMessage, LLMToolCall } from "../llm/provider";
import type { ToolResult } from "../tools/tools";
import type { RunContext } from "../events/events";

export type RuntimeStatus =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export interface RuntimeState {
  /**
   * Identifiant unique du run.
   */
  runId: string;

  context: RunContext;
  /**
   * Agent exécuté pendant ce run.
   */
  agent: Agent;

  /**
   * État actuel du run.
   */
  status: RuntimeStatus;

  /**
   * Historique complet du run.
   *
   * Contient les messages utilisateur,
   * les tool calls de l'assistant et les résultats des tools.
   */
  messages: LLMMessage[];

  /**
   * Numéro du tour actuel du runtime.
   */
  turn: number;

  /**
   * Nombre maximal de tours autorisés.
   */
  maxTurns: number;

  /**
   * Identifiant de l'approbation actuellement en attente.
   */
  pendingApprovalId?: string;

  /**
   * Tool call qui attend actuellement une approbation.
   *
   * Permet au runtime de reprendre exactement
   * l'action interrompue après approval.
   */
  pendingToolCall?: LLMToolCall;

  /**
   * Résultats des tools exécutés pendant le run.
   */
  toolResults: ToolResult[];

  /**
   * Réponse finale de l'agent.
   */
  result?: string;

  /**
   * Erreur ayant provoqué l'échec du run.
   */
  error?: string;
}