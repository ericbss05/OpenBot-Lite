"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useParams } from "next/navigation";
import {
  Loader2,
  MessageCircleQuestion,
  SendHorizontal,
  ShieldAlert,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useChannelDetail } from "@/hooks/useChannelDetail";
import { useChannelMessages } from "@/hooks/useChannelMessages";
import { useChannelEvents } from "@/hooks/useChannelEvents";
import { useChannelApprovals } from "@/hooks/useChannelApprovals";

import {
  resumeUserInteraction,
  type ChannelMessage,
  type UserInteraction,
} from "@/lib/api/channels";

type MessageApproval = NonNullable<ChannelMessage["approval"]>;
type MessageInteraction = NonNullable<ChannelMessage["interaction"]>;

/*
 * Champs réellement utilisés par la carte. Les approvals temps réel
 * (hook) n'ont pas createdAt / decidedAt comme celles de la base.
 */
type ApprovalView = Pick<MessageApproval, "id" | "toolId" | "arguments">;

type ActiveInteraction = {
  interaction: UserInteraction;
  runId: string;
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function toUserInteraction(
  interaction: MessageInteraction,
): UserInteraction {
  return {
    type: interaction.type,
    question: interaction.question,
    options: interaction.options ?? undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*  Sous-composants                                                           */
/* -------------------------------------------------------------------------- */

function ApprovalCard({
  approval,
  processing,
  disabled,
  onApprove,
  onReject,
}: {
  approval: ApprovalView;
  processing: boolean;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Card className="flex max-w-[85%] flex-col gap-4 p-4 shadow-none">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />

        <div className="min-w-0">
          <p className="text-sm font-medium">Approbation requise</p>

          <p className="mt-1 text-sm text-muted-foreground">
            L&apos;agent souhaite exécuter une action nécessitant votre
            autorisation.
          </p>
        </div>
      </div>

      <div className="rounded-md bg-muted p-3">
        <p className="font-mono text-xs font-medium">{approval.toolId}</p>

        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
          {JSON.stringify(approval.arguments, null, 2)}
        </pre>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onReject}
        >
          {processing && <Loader2 className="animate-spin" />}
          Refuser
        </Button>

        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={onApprove}
        >
          {processing && <Loader2 className="animate-spin" />}
          Autoriser
        </Button>
      </div>
    </Card>
  );
}

function InteractionCard({
  interaction,
  answered,
  selectedValue,
  processing,
  error,
  onAnswer,
}: {
  interaction: UserInteraction;
  /** Une fois répondue, la carte reste visible mais n'est plus cliquable. */
  answered: boolean;
  selectedValue?: string;
  processing: boolean;
  error: string | null;
  onAnswer: (answer: string) => void;
}) {
  const [text, setText] = useState("");

  const hasOptions =
    !!interaction.options && interaction.options.length > 0;

  const title =
    interaction.type === "clarification"
      ? "Précision requise"
      : "Votre choix";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = text.trim();

    if (!value || processing) {
      return;
    }

    onAnswer(value);
  };

  return (
    <Card className="flex max-w-[85%] flex-col gap-4 p-4 shadow-none">
      <div className="flex items-start gap-3">
        <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>

          <p className="mt-1 text-sm leading-6">{interaction.question}</p>
        </div>
      </div>

      {hasOptions ? (
        <div className="flex flex-wrap gap-2">
          {interaction.options!.map((option) => {
            const selected = answered && option.value === selectedValue;

            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                disabled={processing || answered}
                onClick={() => onAnswer(option.value)}
                className={cn(selected && "disabled:opacity-100")}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      ) : answered ? (
        selectedValue !== undefined && (
          <p className="text-sm text-muted-foreground">
            Réponse : {selectedValue}
          </p>
        )
      ) : (
        <form className="flex gap-2" onSubmit={handleSubmit}>
          <Input
            name="answer"
            type="text"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={processing}
            placeholder="Votre réponse..."
          />

          <Button type="submit" disabled={processing || !text.trim()}>
            {processing && <Loader2 className="animate-spin" />}
            Répondre
          </Button>
        </form>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function ChannelPage() {
  const params = useParams<{ id: string }>();

  const channelId = params.id;

  const {
    channel,
    loading: channelLoading,
    error: channelError,
  } = useChannelDetail(channelId);

  const {
    messages: rawMessages,
    loading: messagesLoading,
    error: messagesError,
    send,
    appendMessage,
    refresh,
  } = useChannelMessages(channelId);

  const { approvals, addApproval, removeApproval, approve, reject } =
    useChannelApprovals();

  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const [processingApprovalId, setProcessingApprovalId] = useState<
    string | null
  >(null);

  /*
   * Approvals déjà traitées (autorisées / refusées). Elles restent
   * "pending" dans la liste des messages tant que l'historique n'est
   * pas rechargé : on les masque donc localement.
   */
  const [resolvedApprovalIds, setResolvedApprovalIds] = useState<
    string[]
  >([]);

  const markApprovalResolved = (approvalId: string) => {
    setResolvedApprovalIds((previous) =>
      previous.includes(approvalId)
        ? previous
        : [...previous, approvalId],
    );
  };

  /* Interaction reçue en temps réel (SSE / WebSocket). */
  const [pendingInteraction, setPendingInteraction] =
    useState<ActiveInteraction | null>(null);

  const [processingInteraction, setProcessingInteraction] =
    useState(false);

  const [interactionError, setInteractionError] = useState<
    string | null
  >(null);

  /*
   * Interactions reçues en temps réel (par runId). Elles s'affichent
   * même si le message correspondant n'est pas (encore) porteur de
   * `interaction` dans la liste des messages.
   */
  const [liveInteractions, setLiveInteractions] = useState<
    Record<string, UserInteraction>
  >({});

  /*
   * Interactions déjà répondues, avec la réponse choisie.
   * Sert à :
   *  - masquer la carte même si le message est encore "pending"
   *    dans l'état local / en base,
   *  - afficher la réponse de l'utilisateur dans la conversation.
   */
  const [answeredInteractions, setAnsweredInteractions] = useState<
    Record<string, { value: string; label: string }>
  >({});

  const isAnswered = (runId: string) => runId in answeredInteractions;

  /* Sécurité : un même message ne doit jamais apparaître deux fois. */
  const messages = rawMessages.filter(
    (message, index) =>
      rawMessages.findIndex((other) => other.id === message.id) === index,
  );

  /*
   * Une interaction (runId) ne doit produire qu'une seule carte, même si
   * plusieurs messages la portent (doublon SSE + base, etc.).
   * On garde le premier message comme propriétaire de la carte.
   */
  const interactionInfo: Record<
    string,
    { ownerId: string; answeredInDb: boolean }
  > = {};

  for (const message of messages) {
    const item = message.interaction;

    if (!item) {
      continue;
    }

    const existing = interactionInfo[item.runId];
    const answeredInDb = item.status !== "pending";

    if (existing) {
      existing.answeredInDb = existing.answeredInDb || answeredInDb;
    } else {
      interactionInfo[item.runId] = { ownerId: message.id, answeredInDb };
    }
  }

  /* Cartes reçues en temps réel pas encore portées par un message. */
  const liveCards = Object.entries(liveInteractions).filter(
    ([runId]) => !interactionInfo[runId],
  );

  /* Bulles de l'agent qui répètent la question d'une carte live. */
  const hiddenBubbleIds: string[] = [];

  for (const [, live] of liveCards) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const candidate = messages[i];

      if (
        candidate.role !== "user" &&
        candidate.content.trim() === live.question.trim()
      ) {
        hiddenBubbleIds.push(candidate.id);
        break;
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Données dérivées                                                      */
  /* ---------------------------------------------------------------------- */

  /*
   * Dernière interaction encore pending dans l'historique
   * (restaurée depuis PostgreSQL), hors interactions déjà répondues.
   */
  let persistedInteraction: ActiveInteraction | null = null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const interaction = messages[i].interaction;

    if (
      interaction &&
      interaction.status === "pending" &&
      !isAnswered(interaction.runId)
    ) {
      persistedInteraction = {
        interaction: toUserInteraction(interaction),
        runId: interaction.runId,
      };

      break;
    }
  }

  /* L'interaction temps réel prend priorité sur celle de la base. */
  const activeInteraction = pendingInteraction ?? persistedInteraction;

  /* Approvals persistées + approvals reçues en temps réel. */
  const persistedApprovals: ApprovalView[] = [];

  for (const message of messages) {
    if (
      message.approval &&
      message.approval.status === "pending" &&
      !resolvedApprovalIds.includes(message.approval.id)
    ) {
      persistedApprovals.push(message.approval);
    }
  }

  const displayedApprovals: ApprovalView[] = [
    ...persistedApprovals,
    ...approvals.filter(
      (approval) =>
        !resolvedApprovalIds.includes(approval.id) &&
        !persistedApprovals.some((p) => p.id === approval.id),
    ),
  ];

  /*
   * Approvals reçues en temps réel qu'aucun message ne porte (encore) :
   * on les affiche à la fin de la conversation.
   */
  const orphanApprovals = displayedApprovals.filter(
    (approval) =>
      !messages.some(
        (message) =>
          message.approvalId === approval.id ||
          message.approval?.id === approval.id,
      ),
  );

  /* ---------------------------------------------------------------------- */
  /*  Événements temps réel                                                 */
  /* ---------------------------------------------------------------------- */

  const handleMessageCreated = useCallback(
    (message: ChannelMessage) => {
      appendMessage(message);

      if (
        message.interaction &&
        message.interaction.status === "pending"
      ) {
        setPendingInteraction({
          interaction: toUserInteraction(message.interaction),
          runId: message.interaction.runId,
        });
      }

      /*
       * Le message référence une interaction mais ne l'embarque pas :
       * on recharge l'historique pour récupérer la version complète.
       */
      if (message.interactionId && !message.interaction) {
        void refresh();
      }
    },
    [appendMessage, refresh],
  );

  const handleUserInteractionRequired = useCallback(
    (interaction: UserInteraction, runId: string) => {
      setPendingInteraction({ interaction, runId });

      setLiveInteractions((previous) => ({
        ...previous,
        [runId]: interaction,
      }));

      void refresh();
    },
    [refresh],
  );

  /* Nouvelle approval : on l'ajoute puis on recharge l'historique. */
  const handleApprovalRequired = useCallback(
    (...args: Parameters<typeof addApproval>) => {
      addApproval(...args);

      void refresh();
    },
    [addApproval, refresh],
  );

  /* Approval traitée (ici ou dans un autre onglet) : on la retire. */
  const handleApprovalResolved = useCallback(
    (...args: Parameters<typeof removeApproval>) => {
      removeApproval(...args);

      const resolved: unknown = args[0];

      if (typeof resolved === "string") {
        setResolvedApprovalIds((previous) =>
          previous.includes(resolved) ? previous : [...previous, resolved],
        );
      }

      void refresh();
    },
    [removeApproval, refresh],
  );

  const { connected, runtimeStatus } = useChannelEvents(channelId, {
    onMessageCreated: handleMessageCreated,
    onApprovalRequired: handleApprovalRequired,
    onApprovalResolved: handleApprovalResolved,
    onUserInteractionRequired: handleUserInteractionRequired,
  });

  /* ---------------------------------------------------------------------- */
  /*  Actions                                                               */
  /* ---------------------------------------------------------------------- */

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = content.trim();

    if (!value || sending) {
      return;
    }

    setSending(true);

    try {
      await send(value);
      setContent("");
    } catch {
      // L'erreur est déjà gérée dans useChannelMessages.
    } finally {
      setSending(false);
    }
  };

  const handleApprove = async (approvalId: string) => {
    if (processingApprovalId) {
      return;
    }

    setProcessingApprovalId(approvalId);

    try {
      await approve(approvalId);
      markApprovalResolved(approvalId);
    } catch (error) {
      console.error("[APPROVAL] Failed to approve:", error);
    } finally {
      setProcessingApprovalId(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    if (processingApprovalId) {
      return;
    }

    setProcessingApprovalId(approvalId);

    try {
      await reject(approvalId);
      markApprovalResolved(approvalId);
    } catch (error) {
      console.error("[APPROVAL] Failed to reject:", error);
    } finally {
      setProcessingApprovalId(null);
    }
  };

  /*
   * La réponse est envoyée pour l'interaction qui a été cliquée (runId),
   * pas forcément pour activeInteraction : ça évite d'envoyer la réponse
   * au mauvais run s'il y a plusieurs interactions dans l'historique.
   */
  const handleInteractionAnswer = async (
    runId: string,
    answer: string,
    label: string,
  ) => {
    if (processingInteraction || isAnswered(runId)) {
      return;
    }

    setProcessingInteraction(true);
    setInteractionError(null);

    try {
      await resumeUserInteraction(runId, answer);

      setAnsweredInteractions((previous) => ({
        ...previous,
        [runId]: { value: answer, label },
      }));

      setPendingInteraction((current) =>
        current?.runId === runId ? null : current,
      );
    } catch (error) {
      console.error("[INTERACTION] Failed to send answer:", error);

      setInteractionError(
        "Impossible d'envoyer la réponse. Réessayez.",
      );
    } finally {
      setProcessingInteraction(false);
    }
  };

  /* Défilement automatique vers le dernier élément. */
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollSignal =
    messages.length + displayedApprovals.length + liveCards.length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [scrollSignal, runtimeStatus]);

  /* ---------------------------------------------------------------------- */
  /*  États de chargement                                                   */
  /* ---------------------------------------------------------------------- */

  if (channelLoading) {
    return (
      <main className="flex min-h-full items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Chargement...
      </main>
    );
  }

  if (channelError) {
    return (
      <main className="p-6">
        <Alert variant="destructive" className="mx-auto max-w-xl">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{channelError}</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!channel) {
    return (
      <main className="flex min-h-full items-center justify-center p-6 text-sm text-muted-foreground">
        Channel introuvable.
      </main>
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Rendu                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <main className="flex min-h-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/80 px-6 py-3 backdrop-blur">
        <div className="min-w-0">
          <h1 className="truncate text-base font-medium">{channel.name}</h1>

          <p className="truncate text-xs text-muted-foreground">
            {channel.id}
          </p>
        </div>

        <Badge
          variant="outline"
          className="shrink-0 gap-1.5 font-normal text-muted-foreground"
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              connected ? "bg-green-500" : "bg-muted-foreground/40",
            )}
          />

          {connected ? "Connecté" : "Déconnecté"}
        </Badge>
      </header>

      {/* Messages */}
      <section className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {messagesLoading && (
            <p className="text-sm text-muted-foreground">
              Chargement des messages...
            </p>
          )}

          {messagesError && (
            <Alert variant="destructive">
              <AlertDescription>{messagesError}</AlertDescription>
            </Alert>
          )}

          {!messagesLoading &&
            messages.length === 0 &&
            displayedApprovals.length === 0 &&
            !activeInteraction && (
              <div className="py-24 text-center">
                <p className="text-sm font-medium">Aucun message</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Envoyez un message pour commencer.
                </p>
              </div>
            )}

          {/* Conversation */}
          {messages.map((message) => {
            const isUser = message.role === "user";

            /* Approval */
            const messageApproval =
              message.approval &&
              message.approval.status === "pending" &&
              !resolvedApprovalIds.includes(message.approval.id)
                ? message.approval
                : null;

            const liveApproval = messageApproval
              ? null
              : displayedApprovals.find(
                  (item) => item.id === message.approvalId,
                );

            const approval = messageApproval ?? liveApproval ?? null;

            const processingApproval = approval
              ? processingApprovalId === approval.id
              : false;

            /* Interaction */
            const interaction = message.interaction ?? null;

            const localAnswer = interaction
              ? answeredInteractions[interaction.runId]
              : undefined;

            const info = interaction
              ? interactionInfo[interaction.runId]
              : undefined;

            /* Une seule carte par interaction. */
            const isCardOwner = !!info && info.ownerId === message.id;

            /* Répondue : localement, ou déjà marquée côté base. */
            const answered =
              !!interaction &&
              (!!info?.answeredInDb || localAnswer !== undefined);

            /*
             * On masque le texte uniquement si c'est le message qui porte
             * la carte ET qu'il répète exactement la question.
             */
            const hideBubble =
              hiddenBubbleIds.includes(message.id) ||
              (!!interaction &&
                isCardOwner &&
                message.content.trim() === interaction.question.trim());

            return (
              <div key={message.id} className="flex flex-col gap-3">
                {!hideBubble &&
                  (isUser ? (
                    <div className="flex justify-end">
                      <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-sm leading-6 text-primary-foreground">
                        {message.content}
                      </p>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-sm leading-6 text-foreground">
                        {message.content}
                      </p>
                    </div>
                  ))}

                {approval && (
                  <ApprovalCard
                    approval={approval}
                    processing={processingApproval}
                    disabled={processingApprovalId !== null}
                    onApprove={() => void handleApprove(approval.id)}
                    onReject={() => void handleReject(approval.id)}
                  />
                )}

                {interaction && isCardOwner && (
                  <InteractionCard
                    interaction={toUserInteraction(interaction)}
                    answered={answered}
                    selectedValue={localAnswer?.value}
                    processing={processingInteraction}
                    error={answered ? null : interactionError}
                    onAnswer={(answer) => {
                      const label =
                        interaction.options?.find(
                          (option) => option.value === answer,
                        )?.label ?? answer;

                      void handleInteractionAnswer(
                        interaction.runId,
                        answer,
                        label,
                      );
                    }}
                  />
                )}
              </div>
            );
          })}

          {/* Interactions reçues en temps réel, pas encore dans l'historique */}
          {liveCards.map(([runId, live]) => (
            <InteractionCard
              key={runId}
              interaction={live}
              answered={isAnswered(runId)}
              selectedValue={answeredInteractions[runId]?.value}
              processing={processingInteraction}
              error={isAnswered(runId) ? null : interactionError}
              onAnswer={(answer) => {
                const label =
                  live.options?.find((option) => option.value === answer)
                    ?.label ?? answer;

                void handleInteractionAnswer(runId, answer, label);
              }}
            />
          ))}

          {/* Approvals reçues en temps réel, pas encore dans l'historique */}
          {orphanApprovals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              processing={processingApprovalId === approval.id}
              disabled={processingApprovalId !== null}
              onApprove={() => void handleApprove(approval.id)}
              onReject={() => void handleReject(approval.id)}
            />
          ))}

          {/* Runtime status */}
          {runtimeStatus &&
            displayedApprovals.length === 0 &&
            !activeInteraction && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />

                {runtimeStatus}
              </div>
            )}

          <div ref={bottomRef} className="scroll-mb-24" />
        </div>
      </section>

      {/* Composer */}
      <section className="sticky bottom-0 border-t bg-background px-6 py-3">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-2xl items-end gap-2"
        >
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Écrire un message..."
            rows={1}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();

                if (content.trim() && !sending) {
                  event.currentTarget.form?.requestSubmit();
                }
              }
            }}
            className="max-h-40 min-h-10 resize-none"
          />

          <Button
            type="submit"
            size="icon"
            aria-label="Envoyer"
            disabled={sending || !content.trim()}
            className="size-10 shrink-0"
          >
            {sending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <SendHorizontal />
            )}
          </Button>
        </form>
      </section>
    </main>
  );
}