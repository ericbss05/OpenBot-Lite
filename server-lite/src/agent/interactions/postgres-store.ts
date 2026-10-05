import {
  and,
  eq,
} from "drizzle-orm";

import type { Db } from "../../db";
import { interactions } from "../../db/schema";

import type {
  UserInteraction,
  UserInteractionOption,
} from "./user-interaction";

export type InteractionStatus =
  | "pending"
  | "answered"
  | "cancelled";

export interface InteractionRequest {
  id: string;
  runId: string;
  toolCallId: string;
  interaction: UserInteraction;
}

export interface InteractionRecord {
  id: string;
  runId: string;
  toolCallId: string;
  interaction: UserInteraction;
  status: InteractionStatus;
  answer?: string;
  createdAt: Date;
  answeredAt?: Date;
}

export interface InteractionStore {
  create(
    request: InteractionRequest,
  ): Promise<void>;

  get(
    interactionId: string,
  ): Promise<InteractionRecord | null>;

  getPendingByRunId(
    runId: string,
  ): Promise<InteractionRecord | null>;

  answer(
    interactionId: string,
    answer: string,
  ): Promise<void>;

  cancel(
    interactionId: string,
  ): Promise<void>;
}

export function createPostgresInteractionStore(
  db: Db,
): InteractionStore {
  return {
    async create(
      request: InteractionRequest,
    ): Promise<void> {
      await db
        .insert(interactions)
        .values({
          id: request.id,
          runId: request.runId,
          toolCallId: request.toolCallId,
          type: request.interaction.type,
          question:
            request.interaction.question,
          options:
            request.interaction.options,
          status: "pending",
        });
    },

    async get(
      interactionId: string,
    ): Promise<InteractionRecord | null> {
      const [row] = await db
        .select()
        .from(interactions)
        .where(
          eq(
            interactions.id,
            interactionId,
          ),
        )
        .limit(1);

      if (!row) {
        return null;
      }

      const options =
        row.options ??
        undefined;

      return {
        id: row.id,

        runId: row.runId,
        toolCallId: row.toolCallId,

        interaction: {
          type: row.type,
          question: row.question,
          options:
            options as
              | UserInteractionOption[]
              | undefined,
        },

        status: row.status,
        answer:
          row.answer ??
          undefined,
        createdAt:
          row.createdAt,
        answeredAt:
          row.answeredAt ??
          undefined,
      };
    },

    async getPendingByRunId(
      runId: string,
    ): Promise<InteractionRecord | null> {
      const [row] = await db
        .select()
        .from(interactions)
        .where(
          and(
            eq(interactions.runId, runId),
            eq(
              interactions.status,
              "pending",
            ),
          ),
        )
        .limit(1);

      if (!row) {
        return null;
      }

      const options =
        row.options ??
        undefined;

      return {
        id: row.id,
        runId: row.runId,
        toolCallId: row.toolCallId,

        interaction: {
          type: row.type,
          question: row.question,
          options:
            options as
              | UserInteractionOption[]
              | undefined,
        },

        status: row.status,
        answer:
          row.answer ??
          undefined,
        createdAt:
          row.createdAt,
        answeredAt:
          row.answeredAt ??
          undefined,
      };
    },

    async answer(
      interactionId: string,
      answer: string,
    ): Promise<void> {
      await db
        .update(interactions)
        .set({
          status: "answered",
          answer,
          answeredAt: new Date(),
        })
        .where(
          eq(
            interactions.id,
            interactionId,
          ),
        );
    },

    async cancel(
      interactionId: string,
    ): Promise<void> {
      await db
        .update(interactions)
        .set({
          status: "cancelled",
        })
        .where(
          eq(
            interactions.id,
            interactionId,
          ),
        );
    },
  };
}