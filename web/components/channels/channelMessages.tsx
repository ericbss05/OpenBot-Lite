import {
  useEffect,
  useRef,
} from "react";

import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Loader2,
} from "lucide-react";

import type {
  ChannelMessage,
} from "@/lib/api/channels";

import {
  ApprovalCard,
} from "./approvalCard";

import {
  InteractionCard,
} from "./interactionCard";

import type {
  ActiveInteraction,
  ApprovalDecision,
  ApprovalStatus,
  ApprovalView,
  InteractionInfo,
  InteractionStatus,
} from "./types";

import {
  getInteractionAnswer,
  interactionKey,
  toInteractionStatus,
  toUserInteraction,
} from "./helpers";

type ChannelMessagesProps = {
  messages: ChannelMessage[];
  messagesLoading: boolean;
  messagesError: string | null;

  approvals: ApprovalView[];

  approvalDecisions: Record<
    string,
    ApprovalDecision
  >;

  liveInteractions: Record<
    string,
    ActiveInteraction
  >;

  answeredInteractions: Record<
    string,
    string
  >;

  pendingInteraction:
    | ActiveInteraction
    | null;

  processingApprovalId:
    | string
    | null;

  processingInteraction: boolean;

  interactionError: string | null;

  runtimeStatus:
    | string
    | null;

  onDecision: (
    approval: ApprovalView,
    decision:
      | "approved"
      | "rejected",
  ) => void;

  onInteractionAnswer: (
    runId: string,
    question: string,
    answer: string,
  ) => void;

  emptyMessage?: string;
};

export function ChannelMessages({
  messages: rawMessages,
  messagesLoading,
  messagesError,
  approvals,
  approvalDecisions,
  liveInteractions,
  answeredInteractions,
  pendingInteraction,
  processingApprovalId,
  processingInteraction,
  interactionError,
  runtimeStatus,
  onDecision,
  onInteractionAnswer,
  emptyMessage,
}: ChannelMessagesProps) {
  const bottomRef =
    useRef<HTMLDivElement>(
      null,
    );

  const messages =
    rawMessages.filter(
      (
        message,
        index,
      ) =>
        rawMessages.findIndex(
          (other) =>
            other.id ===
            message.id,
        ) === index,
    );

  // ------------------------------------------------
  // Interactions
  // ------------------------------------------------

  const interactionInfo: Record<
    string,
    InteractionInfo
  > = {};

  const messageInteractionKeys: string[] =
    [];

  for (const message of messages) {
    const item =
      message.interaction;

    if (!item) {
      continue;
    }

    const questionKey =
      interactionKey(
        item.runId,
        item.question,
      );

    const key =
      message.interactionId ??
      questionKey;

    const status =
      toInteractionStatus(
        item.status,
      );

    const answer =
      getInteractionAnswer(
        item,
      );

    messageInteractionKeys.push(
      questionKey,
    );

    const existing =
      interactionInfo[key];

    if (!existing) {
      interactionInfo[key] = {
        ownerId: message.id,
        status,
        answer,
      };
    } else if (
      existing.status ===
        "pending" &&
      status !== "pending"
    ) {
      existing.status =
        status;

      existing.answer =
        answer ??
        existing.answer;
    } else if (
      existing.answer === null &&
      answer !== null
    ) {
      existing.answer =
        answer;
    }
  }

  const liveCards =
    Object.entries(
      liveInteractions,
    ).filter(
      ([key]) =>
        !messageInteractionKeys.includes(
          key,
        ),
    );

  const hiddenBubbleIds: string[] =
    [];

  for (const [, live] of liveCards) {
    for (
      let i =
        messages.length -
        1;
      i >= 0;
      i--
    ) {
      const candidate =
        messages[i];

      if (
        candidate.role !==
          "user" &&
        candidate.content.trim() ===
          live.interaction.question.trim()
      ) {
        hiddenBubbleIds.push(
          candidate.id,
        );
        break;
      }
    }
  }

  let persistedInteraction:
    | ActiveInteraction
    | null = null;

  for (
    let i =
      messages.length -
      1;
    i >= 0;
    i--
  ) {
    const item =
      messages[i]
        .interaction;

    if (!item) {
      continue;
    }

    const key =
      messages[i]
        .interactionId ??
      interactionKey(
        item.runId,
        item.question,
      );

    if (
      interactionInfo[key]
        ?.status ===
        "pending" &&
      !(
        interactionKey(
          item.runId,
          item.question,
        ) in
        answeredInteractions
      )
    ) {
      persistedInteraction =
        {
          interaction:
            toUserInteraction(
              item,
            ),
          runId:
            item.runId,
        };

      break;
    }
  }

  const activeInteraction =
    pendingInteraction ??
    persistedInteraction;

  // ------------------------------------------------
  // Approvals
  // ------------------------------------------------

  const getApprovalStatus = (
    approvalId: string,
    dbStatus?: string,
  ): ApprovalStatus => {
    const decision =
      approvalDecisions[
        approvalId
      ]?.status;

    if (
      decision ===
        "approved" ||
      decision ===
        "rejected"
    ) {
      return decision;
    }

    if (
      dbStatus ===
      "approved"
    ) {
      return "approved";
    }

    if (
      dbStatus ===
      "rejected"
    ) {
      return "rejected";
    }

    return (
      decision ??
      "pending"
    );
  };

  const approvalOwner: Record<
    string,
    string
  > = {};

  for (const message of messages) {
    const id =
      message.approval?.id ??
      message.approvalId;

    if (
      id &&
      !(id in approvalOwner)
    ) {
      approvalOwner[id] =
        message.id;
    }
  }

  const knownApprovals: ApprovalView[] =
    [...approvals];

  for (const decision of Object.values(
    approvalDecisions,
  )) {
    if (
      !knownApprovals.some(
        (item) =>
          item.id ===
          decision.approval.id,
      )
    ) {
      knownApprovals.push(
        decision.approval,
      );
    }
  }

  const orphanApprovals =
    knownApprovals.filter(
      (approval) =>
        !messages.some(
          (message) =>
            message.approvalId ===
              approval.id ||
            message.approval?.id ===
              approval.id,
        ),
    );

  let pendingApprovalCount =
    0;

  const countedApprovalIds: string[] =
    [];

  for (const message of messages) {
    if (
      message.approval
    ) {
      countedApprovalIds.push(
        message.approval.id,
      );

      if (
        getApprovalStatus(
          message.approval.id,
          message.approval.status,
        ) === "pending"
      ) {
        pendingApprovalCount++;
      }
    }
  }

  for (const approval of knownApprovals) {
    if (
      !countedApprovalIds.includes(
        approval.id,
      ) &&
      getApprovalStatus(
        approval.id,
      ) === "pending"
    ) {
      pendingApprovalCount++;
    }
  }

  // ------------------------------------------------
  // Scroll
  // ------------------------------------------------

  const scrollSignal =
    messages.length +
    knownApprovals.length +
    liveCards.length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView(
      {
        behavior: "smooth",
        block: "end",
      },
    );
  }, [
    scrollSignal,
    runtimeStatus,
  ]);

  // ------------------------------------------------
  // États globaux
  // ------------------------------------------------

  if (messagesLoading) {
    return (
      <section className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Chargement...
        </div>
      </section>
    );
  }

  if (messagesError) {
    return (
      <section className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <Alert variant="destructive">
            <AlertDescription>
              {messagesError}
            </AlertDescription>
          </Alert>
        </div>
      </section>
    );
  }

  if (emptyMessage) {
    return (
      <section className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <Alert>
            <AlertDescription>
              {emptyMessage}
            </AlertDescription>
          </Alert>
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 overflow-y-auto px-6 py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {!messagesLoading &&
          messages.length === 0 &&
          knownApprovals.length === 0 &&
          !activeInteraction && (
            <div className="py-24 text-center">
              <p className="text-sm font-medium">
                Aucun message
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Envoyez un message pour commencer.
              </p>
            </div>
          )}

        {messages.map(
          (message) => {
            const isUser =
              message.role ===
              "user";

            const approval:
              | ApprovalView
              | null =
              message.approval ??
              knownApprovals.find(
                (item) =>
                  item.id ===
                  message.approvalId,
              ) ??
              null;

            const approvalStatus =
              approval
                ? getApprovalStatus(
                    approval.id,
                    message
                      .approval
                      ?.status,
                  )
                : "pending";

            const isApprovalOwner =
              !!approval &&
              approvalOwner[
                approval.id
              ] ===
                message.id;

            const interaction =
              message.interaction ??
              null;

            const questionKey =
              interaction
                ? interactionKey(
                    interaction.runId,
                    interaction.question,
                  )
                : null;

            const info =
              interaction
                ? interactionInfo[
                    message
                      .interactionId ??
                      (questionKey as string)
                  ]
                : undefined;

            const isCardOwner =
              !!info &&
              info.ownerId ===
                message.id;

            const localAnswer =
              questionKey !==
                null
                ? answeredInteractions[
                    questionKey
                  ]
                : undefined;

            const cardStatus: InteractionStatus =
              info &&
              info.status !==
                "pending"
                ? info.status
                : localAnswer !==
                    undefined
                  ? "answered"
                  : "pending";

            const cardAnswer =
              info?.answer ??
              localAnswer ??
              null;

            const hideBubble =
              hiddenBubbleIds.includes(
                message.id,
              ) ||
              (!!interaction &&
                isCardOwner &&
                message.content
                  .trim() ===
                  interaction.question
                    .trim());

            return (
              <div
                key={
                  message.id
                }
                className="flex flex-col gap-3"
              >
                {!hideBubble &&
                  (isUser ? (
                    <div className="flex justify-end">
                      <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-sm leading-6 text-primary-foreground">
                        {
                          message.content
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-sm leading-6 text-foreground">
                        {
                          message.content
                        }
                      </p>
                    </div>
                  ))}

                {approval &&
                  isApprovalOwner && (
                    <ApprovalCard
                      approval={
                        approval
                      }
                      status={
                        approvalStatus
                      }
                      processing={
                        processingApprovalId ===
                        approval.id
                      }
                      disabled={
                        processingApprovalId !==
                        null
                      }
                      onApprove={() =>
                        onDecision(
                          approval,
                          "approved",
                        )
                      }
                      onReject={() =>
                        onDecision(
                          approval,
                          "rejected",
                        )
                      }
                    />
                  )}

                {interaction &&
                  isCardOwner && (
                    <InteractionCard
                      interaction={toUserInteraction(
                        interaction,
                      )}
                      status={
                        cardStatus
                      }
                      answer={
                        cardAnswer
                      }
                      processing={
                        processingInteraction
                      }
                      error={
                        interactionError
                      }
                      onAnswer={(
                        answer,
                      ) =>
                        onInteractionAnswer(
                          interaction.runId,
                          interaction.question,
                          answer,
                        )
                      }
                    />
                  )}
              </div>
            );
          },
        )}

        {liveCards.map(
          ([key, live]) => (
            <InteractionCard
              key={key}
              interaction={
                live.interaction
              }
              status={
                answeredInteractions[
                  key
                ]
                  ? "answered"
                  : "pending"
              }
              answer={
                answeredInteractions[
                  key
                ] ??
                null
              }
              processing={
                processingInteraction
              }
              error={
                interactionError
              }
              onAnswer={(
                answer,
              ) =>
                onInteractionAnswer(
                  live.runId,
                  live.interaction
                    .question,
                  answer,
                )
              }
            />
          ),
        )}

        {orphanApprovals.map(
          (approval) => (
            <ApprovalCard
              key={
                approval.id
              }
              approval={
                approval
              }
              status={getApprovalStatus(
                approval.id,
              )}
              processing={
                processingApprovalId ===
                approval.id
              }
              disabled={
                processingApprovalId !==
                null
              }
              onApprove={() =>
                onDecision(
                  approval,
                  "approved",
                )
              }
              onReject={() =>
                onDecision(
                  approval,
                  "rejected",
                )
              }
            />
          ),
        )}

        {runtimeStatus &&
          pendingApprovalCount ===
            0 &&
          !activeInteraction && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />

              {runtimeStatus}
            </div>
          )}

        <div
          ref={bottomRef}
          className="scroll-mb-24"
        />
      </div>
    </section>
  );
}