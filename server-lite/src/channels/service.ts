import type {
  Channel,
  ChannelMessage,
  CreateChannelInput,
  SendChannelMessageInput,
  UpdateChannelInput,
} from "./types";

export type ChannelService = ReturnType<
  typeof createChannelService
>;

export function createChannelService(
  store: {
    create(
      input: CreateChannelInput,
      userId: string,
    ): Promise<Channel>;

    listOwned(
      userId: string,
    ): Promise<Channel[]>;

    getOwned(
      id: string,
      userId: string,
    ): Promise<Channel | null>;

    updateOwned(
      id: string,
      userId: string,
      input: UpdateChannelInput,
    ): Promise<Channel | null>;

    deleteOwned(
      id: string,
      userId: string,
    ): Promise<boolean>;

    appendMessage(input: {
      channelId: string;
      role: "user" | "assistant" | "system";
      content: string;
      interactionId?: string | null;
      approvalId?: string | null;
      agentId?: string | null;
    }): Promise<{
      id: string;
      createdAt: Date;
    }>;

    history(
      channelId: string,
      limit?: number,
    ): Promise<ChannelMessage[]>;
  },
) {
  return {
    async create(
      input: CreateChannelInput,
      userId: string,
    ) {
      validateAgents(input.agents);

      return store.create(
        input,
        userId,
      );
    },

    async list(userId: string) {
      return store.listOwned(userId);
    },

    async get(
      id: string,
      userId: string,
    ) {
      return store.getOwned(
        id,
        userId,
      );
    },

    async update(
      id: string,
      userId: string,
      input: UpdateChannelInput,
    ) {
      if (input.agents !== undefined) {
        validateAgents(input.agents);
      }

      return store.updateOwned(
        id,
        userId,
        input,
      );
    },

    async delete(
      id: string,
      userId: string,
    ) {
      return store.deleteOwned(
        id,
        userId,
      );
    },

    async getHistory(
      id: string,
      userId: string,
      limit = 100,
    ) {
      const channel = await store.getOwned(
        id,
        userId,
      );

      if (!channel) {
        return null;
      }

      return store.history(
        channel.id,
        limit,
      );
    },

    async sendMessage(
      input: SendChannelMessageInput,
      userId: string,
    ) {
      const channel = await store.getOwned(
        input.channelId,
        userId,
      );

      if (!channel) {
        return null;
      }

      if (!channel.active) {
        throw new Error(
          "Channel is inactive",
        );
      }

      const content = input.content.trim();

      if (!content) {
        throw new Error(
          "Message cannot be empty",
        );
      }

      await store.appendMessage({
        channelId: channel.id,
        role: "user",
        content,
      });

      /*
       * Agent Runtime will be connected here.
       *
       * The flow will become:
       *
       * 1. Get channel
       * 2. Get history
       * 3. Resolve primary agent
       * 4. Execute primary agent
       * 5. Allow subagents
       * 6. Save assistant response
       * 7. Return response
       */

      return {
        channel,
        message: content,
      };
    },
  };
}

function validateAgents(
  agents: CreateChannelInput["agents"],
) {
  const primaryAgents = agents.filter(
    (agent) => agent.role === "primary",
  );

  if (primaryAgents.length !== 1) {
    throw new Error(
      "A channel must have exactly one primary agent.",
    );
  }

  const agentIds = new Set(
    agents.map((agent) => agent.agentId),
  );

  if (agentIds.size !== agents.length) {
    throw new Error(
      "An agent cannot be attached to a channel more than once.",
    );
  }
}