import {
  Sandbox,
} from "@e2b/desktop";

import type { AgentStore } from "../../agent-profiles/store";

import {
  E2BDesktopComputer,
} from "./desktop-computer";

export class ComputerSandboxStore {
  constructor(
    private readonly agents: AgentStore,
  ) {}

  /**
   * Returns the persistent sandbox attached to the agent,
   * or creates it when none exists anymore.
   */
  async getOrCreate(
    agentId: string,
  ): Promise<Sandbox> {
    const agent =
      await this.agents.get(agentId);

    if (!agent) {
      throw new Error(
        `Agent not found: ${agentId}`,
      );
    }

    if (agent.computerSandboxId) {
      try {
        return await Sandbox.connect(
          agent.computerSandboxId,
        );
      } catch {
        /*
         * The sandbox recorded on the agent no longer exists.
         * Create a replacement below.
         */
      }
    }

    const sandbox =
      await Sandbox.create({
        timeoutMs:
          2 * 60 * 1000,

        lifecycle: {
          onTimeout: "pause",
          autoResume: true,
        },

        resolution:
          [1280, 800],

        metadata: {
          app: "openbot-lite",
          feature: "computer",
          agentId,
        },
      });

    try {
      await this.agents.setComputerSandboxId(
        agentId,
        sandbox.sandboxId,
      );
    } catch (error) {
      await sandbox
        .kill()
        .catch(() => {});

      throw error;
    }

    return sandbox;
  }

  /**
   * Returns the desktop wrapper around the agent's
   * persistent E2B sandbox.
   */
  async getDesktop(
    agentId: string,
  ): Promise<E2BDesktopComputer> {
    const sandbox =
      await this.getOrCreate(
        agentId,
      );

    return new E2BDesktopComputer(
      sandbox,
    );
  }

  /**
   * Returns the live desktop portal URL for the agent.
   *
   * The stream is created on the persistent sandbox and is
   * not a screenshot transport.
   *
   * viewOnly=false:
   *   the browser can interact with the desktop.
   *
   * viewOnly=true:
   *   the browser can only observe the desktop.
   */
  async getStreamUrl(
    agentId: string,
    viewOnly = false,
  ): Promise<string> {
    const desktop =
      await this.getDesktop(
        agentId,
      );

    return desktop.getStreamUrl(
      viewOnly,
    );
  }

  /**
   * Stops only the live stream.
   *
   * The E2B sandbox itself stays alive and remains attached
   * to the agent.
   */
  async stopStream(
    agentId: string,
  ): Promise<void> {
    const desktop =
      await this.getDesktop(
        agentId,
      );

    await desktop.stopStream();
  }

  /**
   * Completely removes the persistent computer session
   * associated with the agent.
   */
  async remove(
    agentId: string,
  ): Promise<void> {
    const agent =
      await this.agents.get(agentId);

    if (!agent?.computerSandboxId) {
      return;
    }

    try {
      const sandbox =
        await Sandbox.connect(
          agent.computerSandboxId,
        );

      /*
       * Stopping the stream explicitly before killing the
       * sandbox keeps the lifecycle clean.
       */
      await sandbox.stream
        .stop()
        .catch(() => {});

      await sandbox.kill();
    } finally {
      await this.agents.setComputerSandboxId(
        agentId,
        null,
      );
    }
  }
}
