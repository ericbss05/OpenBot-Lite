
"use client";

import {
  type FormEvent,
  useMemo,
  useState,
} from "react";

import {
  useChannelApprovals,
} from "@/hooks/channel/useChannelApprovals";

import {
  useChannelDetail,
} from "@/hooks/channel/useChannelDetail";

import {
  useChannelEvents,
} from "@/hooks/channel/useChannelEvents";

import {
  useChannelMessages,
} from "@/hooks/channel/useChannelMessages";

import {
  resumeUserInteraction,
  type ChannelMessage,
  type UserInteraction,
} from "@/lib/api/channels";

import {
  ChannelComposer,
} from "@/components/channels/channelComposer";

import {
  ChannelMessages,
} from "@/components/channels/channelMessages";

import {
  ChannelToolbar,
} from "./channelToolbar";

import {
  VmDesktop,
} from "./vmDesktop";

import {
  ChannelHeader,
} from "@/app/(protected)/channels/[id]/_components/channelHeader";

import type {
  ActiveInteraction,
  ApprovalDecision,
  ApprovalStatus,
  ApprovalView,
} from "@/components/channels/types";

import {
  interactionKey,
  toUserInteraction,
} from "@/components/channels/helpers";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function resolveChannelAgentId(
  channel: unknown,
): string | null {
  if (
    !channel ||
    typeof channel !== "object"
  ) {
    return null;
  }

  const value =
    channel as Record<string, unknown>;

  /*
   * Compatibilité avec plusieurs formes possibles
   * de la réponse API.
   */

  if (
    typeof value.agentId ===
    "string" &&
    value.agentId
  ) {
    return value.agentId;
  }

  if (
    value.agent &&
    typeof value.agent ===
      "object"
  ) {
    const agent =
      value.agent as Record<
        string,
        unknown
      >;

    if (
      typeof agent.id ===
      "string" &&
      agent.id
    ) {
      return agent.id;
    }

    if (
      typeof agent.agentId ===
      "string" &&
      agent.agentId
    ) {
      return agent.agentId;
    }
  }

  const collections = [
    value.agents,
    value.channelAgents,
  ];

  for (const collection of collections) {
    if (
      !Array.isArray(
        collection,
      )
    ) {
      continue;
    }

    const relations =
      collection.filter(
        (
          item,
        ): item is Record<
          string,
          unknown
        > =>
          Boolean(
            item &&
            typeof item ===
              "object",
          ),
      );

    /*
     * On privilégie l'agent primary.
     */
    const primary =
      relations.find(
        (relation) =>
          relation.role ===
          "primary",
      );

    const candidates = [
      primary,
      ...relations.filter(
        (relation) =>
          relation !==
          primary,
      ),
    ].filter(
      (
        item,
      ): item is Record<
        string,
        unknown
      > => Boolean(item),
    );

    for (const relation of candidates) {
      if (
        typeof relation.agentId ===
          "string" &&
        relation.agentId
      ) {
        return relation.agentId;
      }

      if (
        typeof relation.id ===
          "string" &&
        relation.role !==
          "primary"
      ) {
        /*
         * On n'utilise pas relation.id
         * aveuglément lorsqu'il peut s'agir
         * de l'id de la relation.
         */
      }

      if (
        relation.agent &&
        typeof relation.agent ===
          "object"
      ) {
        const agent =
          relation.agent as Record<
            string,
            unknown
          >;

        if (
          typeof agent.id ===
            "string" &&
          agent.id
        ) {
          return agent.id;
        }

        if (
          typeof agent.agentId ===
            "string" &&
          agent.agentId
        ) {
          return agent.agentId;
        }
      }

      if (
        relation.primaryAgent &&
        typeof relation.primaryAgent ===
          "object"
      ) {
        const primaryAgent =
          relation.primaryAgent as Record<
            string,
            unknown
          >;

        if (
          typeof primaryAgent.id ===
            "string" &&
          primaryAgent.id
        ) {
          return primaryAgent.id;
        }

        if (
          typeof primaryAgent.agentId ===
            "string" &&
          primaryAgent.agentId
        ) {
          return primaryAgent.agentId;
        }
      }
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*  Props                                                                     */
/* -------------------------------------------------------------------------- */

type ChannelWorkspaceProps = {
  channelId: string;
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function ChannelWorkspace({
  channelId,
}: ChannelWorkspaceProps) {
  const {
    channel,
    loading: channelLoading,
    error: channelError,
  } = useChannelDetail(
    channelId,
  );

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    send,
    appendMessage,
    refresh,
  } = useChannelMessages(
    channelId,
  );

  const {
    approvals,
    addApproval,
    removeApproval,
    approve,
    reject,
  } = useChannelApprovals();

  const [
    toolbarOpen,
    setToolbarOpen,
  ] = useState(false);

  const [
    content,
    setContent,
  ] = useState("");

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    processingApprovalId,
    setProcessingApprovalId,
  ] = useState<string | null>(
    null,
  );

  const [
    approvalDecisions,
    setApprovalDecisions,
  ] = useState<
    Record<
      string,
      ApprovalDecision
    >
  >({});

  const [
    pendingInteraction,
    setPendingInteraction,
  ] =
    useState<ActiveInteraction | null>(
      null,
    );

  const [
    liveInteractions,
    setLiveInteractions,
  ] = useState<
    Record<
      string,
      ActiveInteraction
    >
  >({});

  const [
    answeredInteractions,
    setAnsweredInteractions,
  ] = useState<
    Record<string, string>
  >({});

  const [
    processingInteraction,
    setProcessingInteraction,
  ] = useState(false);

  const [
    interactionError,
    setInteractionError,
  ] = useState<string | null>(
    null,
  );

  /* ---------------------------------------------------------------------- */
  /*  Agent associé au channel                                             */
  /* ---------------------------------------------------------------------- */

  const agentId = useMemo(
    () =>
      resolveChannelAgentId(
        channel,
      ),
    [channel],
  );

  console.log(
    "[CHANNEL WORKSPACE] channelId:",
    channelId,
  );

  console.log(
    "[CHANNEL WORKSPACE] channel:",
    channel,
  );

  console.log(
    "[CHANNEL WORKSPACE] resolved agentId:",
    agentId,
  );

  /* ---------------------------------------------------------------------- */
  /*  Events                                                                */
  /* ---------------------------------------------------------------------- */

  const {
    connected,
    events,
    runtimeStatus,
    computerActive,
    computerControlMode,
    humanControlRequest,
  } = useChannelEvents(
    channelId,
    {
      onMessageCreated: (
        message: ChannelMessage,
      ) => {
        appendMessage(
          message,
        );

        if (
          message.interaction &&
          message.interaction.status ===
            "pending"
        ) {
          setPendingInteraction({
            interaction:
              toUserInteraction(
                message.interaction,
              ),
            runId:
              message.interaction.runId,
          });
        }

        if (
          (message.interactionId &&
            !message.interaction) ||
          (message.approvalId &&
            !message.approval)
        ) {
          void refresh();
        }
      },

      onApprovalRequired: (
        ...args: Parameters<
          typeof addApproval
        >
      ) => {
        addApproval(
          ...args,
        );

        void refresh();
      },

      onApprovalResolved: (
        ...args: Parameters<
          typeof removeApproval
        >
      ) => {
        const resolved: unknown =
          args[0];

        if (
          typeof resolved ===
          "string"
        ) {
          const known =
            approvals.find(
              (item) =>
                item.id ===
                resolved,
            );

          if (known) {
            setApprovalDecisions(
              (previous) =>
                previous[
                  resolved
                ]
                  ? previous
                  : {
                      ...previous,
                      [resolved]: {
                        status:
                          "resolved",
                        approval:
                          known,
                      },
                    },
            );
          }
        }

        removeApproval(
          ...args,
        );

        void refresh();
      },

      onUserInteractionRequired: (
        interaction: UserInteraction,
        runId: string,
      ) => {
        setPendingInteraction({
          interaction,
          runId,
        });

        setLiveInteractions(
          (previous) => ({
            ...previous,
            [
              interactionKey(
                runId,
                interaction.question,
              )
            ]: {
              interaction,
              runId,
            },
          }),
        );

        void refresh();
      },

      onHumanControlRequired: () => {
        setToolbarOpen(true);
      },
    },
  );

  /* ---------------------------------------------------------------------- */
  /*  Composer                                                               */
  /* ---------------------------------------------------------------------- */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const value =
      content.trim();

    if (
      !value ||
      sending
    ) {
      return;
    }

    setSending(true);

    try {
      await send(value);
      setContent("");
    } catch {
      // L'erreur est déjà gérée
      // dans useChannelMessages.
    } finally {
      setSending(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /*  Approval                                                               */
  /* ---------------------------------------------------------------------- */

  const handleDecision = async (
    approval: ApprovalView,
    decision:
      | "approved"
      | "rejected",
  ) => {
    if (
      processingApprovalId
    ) {
      return;
    }

    setProcessingApprovalId(
      approval.id,
    );

    try {
      if (
        decision ===
        "approved"
      ) {
        await approve(
          approval.id,
        );
      } else {
        await reject(
          approval.id,
        );
      }

      setApprovalDecisions(
        (previous) => ({
          ...previous,
          [approval.id]: {
            status:
              decision as ApprovalStatus,
            approval,
          },
        }),
      );

      void refresh();
    } catch (error) {
      console.error(
        `[APPROVAL] Failed to ${decision}:`,
        error,
      );
    } finally {
      setProcessingApprovalId(
        null,
      );
    }
  };

  /* ---------------------------------------------------------------------- */
  /*  Interaction                                                            */
  /* ---------------------------------------------------------------------- */

  const handleInteractionAnswer =
    async (
      runId: string,
      question: string,
      answer: string,
    ) => {
      const key =
        interactionKey(
          runId,
          question,
        );

      if (
        processingInteraction ||
        key in answeredInteractions
      ) {
        return;
      }

      setProcessingInteraction(
        true,
      );

      setInteractionError(
        null,
      );

      try {
        await resumeUserInteraction(
          runId,
          answer,
        );

        setAnsweredInteractions(
          (previous) => ({
            ...previous,
            [key]: answer,
          }),
        );

        setPendingInteraction(
          (current) =>
            current &&
            interactionKey(
              current.runId,
              current.interaction
                .question,
            ) === key
              ? null
              : current,
        );

        void refresh();
      } catch (error) {
        console.error(
          "[INTERACTION] Failed to send answer:",
          error,
        );

        setInteractionError(
          "Impossible d'envoyer la réponse. Réessayez.",
        );
      } finally {
        setProcessingInteraction(
          false,
        );
      }
    };

  /* ---------------------------------------------------------------------- */
  /*  Loading                                                                */
  /* ---------------------------------------------------------------------- */

  if (channelLoading) {
    return (
      <ChannelMessages
        messages={[]}
        messagesLoading
        messagesError={null}
        approvals={[]}
        approvalDecisions={{}}
        liveInteractions={{}}
        answeredInteractions={{}}
        pendingInteraction={null}
        processingApprovalId={null}
        processingInteraction={false}
        interactionError={null}
        runtimeStatus={null}
        onDecision={() => {}}
        onInteractionAnswer={() => {}}
      />
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Error                                                                  */
  /* ---------------------------------------------------------------------- */

  if (channelError) {
    return (
      <ChannelMessages
        messages={[]}
        messagesLoading={false}
        messagesError={channelError}
        approvals={[]}
        approvalDecisions={{}}
        liveInteractions={{}}
        answeredInteractions={{}}
        pendingInteraction={null}
        processingApprovalId={null}
        processingInteraction={false}
        interactionError={null}
        runtimeStatus={null}
        onDecision={() => {}}
        onInteractionAnswer={() => {}}
      />
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Channel introuvable                                                    */
  /* ---------------------------------------------------------------------- */

  if (!channel) {
    return (
      <ChannelMessages
        messages={[]}
        messagesLoading={false}
        messagesError={null}
        approvals={[]}
        approvalDecisions={{}}
        liveInteractions={{}}
        answeredInteractions={{}}
        pendingInteraction={null}
        processingApprovalId={null}
        processingInteraction={false}
        interactionError={null}
        runtimeStatus={null}
        onDecision={() => {}}
        onInteractionAnswer={() => {}}
        emptyMessage="Channel introuvable."
      />
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <main
      className={cn(
        "grid h-dvh min-h-0 min-w-0 overflow-hidden",
        "transition-[grid-template-columns] duration-200 ease-in-out",
        toolbarOpen
          ? "grid-cols-[minmax(0,1fr)_22rem]"
          : "grid-cols-[minmax(0,1fr)_0]",
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col">
        <ChannelHeader
          name={channel.name}
          id={channel.id}
          connected={connected}
          toolbarOpen={toolbarOpen}
          onToolbarToggle={() =>
            setToolbarOpen(
              (open) => !open,
            )
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <ChannelMessages
            messages={messages}
            messagesLoading={messagesLoading}
            messagesError={messagesError}
            approvals={approvals}
            approvalDecisions={
              approvalDecisions
            }
            liveInteractions={
              liveInteractions
            }
            answeredInteractions={
              answeredInteractions
            }
            pendingInteraction={
              pendingInteraction
            }
            processingApprovalId={
              processingApprovalId
            }
            processingInteraction={
              processingInteraction
            }
            interactionError={
              interactionError
            }
            runtimeStatus={
              runtimeStatus
            }
            onDecision={
              handleDecision
            }
            onInteractionAnswer={
              handleInteractionAnswer
            }
          />
        </div>

        <ChannelComposer
          content={content}
          sending={sending}
          onChange={setContent}
          onSubmit={handleSubmit}
        />
      </div>

      <ChannelToolbar>
        {agentId ? (
          <VmDesktop
            agentId={agentId}
            events={events}
            computerActive={
              computerActive
            }
            computerControlMode={
              computerControlMode
            }
            humanControlRequest={
              humanControlRequest
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <div className="text-center">
              <p className="text-sm font-medium">
                Agent introuvable
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Aucun agent n&apos;est associé à ce channel.
              </p>
            </div>
          </div>
        )}
      </ChannelToolbar>
    </main>
  );
}

