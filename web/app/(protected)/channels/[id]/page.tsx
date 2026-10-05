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
  Check,
  Loader2,
  MessageCircleQuestion,
  SendHorizontal,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
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

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type MessageApproval = NonNullable<ChannelMessage["approval"]>;
type MessageInteraction = NonNullable<ChannelMessage["interaction"]>;

/*
 * Champs réellement utilisés par la carte d'approbation. Les approvals
 * temps réel (hook) n'ont pas createdAt / decidedAt comme celles de la base.
 */
type ApprovalView = Pick<MessageApproval, "id" | "toolId" | "arguments">;

/* "resolved" = traitée (ex. depuis un autre onglet), décision inconnue. */
type ApprovalStatus = "pending" | "approved" | "rejected" | "resolved";

type InteractionStatus = "pending" | "answered" | "cancelled";

type ActiveInteraction = {
  interaction: UserInteraction;
  runId: string;
};

type ApprovalDecision = {
  status: ApprovalStatus;
  approval: ApprovalView;
};

type InteractionInfo = {
  ownerId: string;
  status: InteractionStatus;
  answer: string | null;
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function toUserInteraction(interaction: MessageInteraction): UserInteraction {
  return {
    type: interaction.type,
    question: interaction.question,
    options: interaction.options ?? undefined,
  };
}

function toInteractionStatus(status: string): InteractionStatus {
  if (status === "answered") return "answered";
  if (status === "cancelled") return "cancelled";

  return "pending";
}

/* Lit `answer` (colonne interactions.answer) sans dépendre du type API. */
function getInteractionAnswer(
  interaction: MessageInteraction,
): string | null {
  const value = (
    interaction as MessageInteraction & { answer?: string | null }
  ).answer;

  return value ?? null;
}

/*
 * Un même run peut poser plusieurs questions : on identifie une
 * interaction par runId + question, ce qui reste stable entre la version
 * temps réel et la version relue depuis la base.
 */
function interactionKey(runId: string, question: string): string {
  return `${runId}::${question}`;
}

/* -------------------------------------------------------------------------- */
/*  Sous-composants                                                           */
/* -------------------------------------------------------------------------- */

function ApprovalCard({
  approval,
  status,
  processing,
  disabled,
  onApprove,
  onReject,
}: {
  approval: ApprovalView;
  status: ApprovalStatus;
  processing: boolean;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const pending = status === "pending";

  const title = {
    pending: "Approbation requise",
    approved: "Action autorisée",
    rejected: "Action refusée",
    resolved: "Action traitée",
  }[status];

  const icon = {
    pending: <ShieldAlert className="size-4 text-amber-500" />,
    approved: <ShieldCheck className="size-4 text-green-500" />,
    rejected: <ShieldX className="size-4 text-destructive" />,
    resolved: <ShieldCheck className="size-4 text-muted-foreground" />,
  }[status];

  return (
    <Card className="flex max-w-[85%] flex-col gap-4 p-4 shadow-none">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>

        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>

          {pending && (
            <p className="mt-1 text-sm text-muted-foreground">
              L&apos;agent souhaite exécuter une action nécessitant votre
              autorisation.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md bg-muted p-3">
        <p className="font-mono text-xs font-medium">{approval.toolId}</p>

        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
          {JSON.stringify(approval.arguments, null, 2)}
        </pre>
      </div>

      {pending && (
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
      )}
    </Card>
  );
}

function InteractionCard({
  interaction,
  status,
  answer,
  processing,
  error,
  onAnswer,
}: {
  interaction: UserInteraction;
  status: InteractionStatus;
  /** Réponse de l'utilisateur (valeur brute), si connue. */
  answer: string | null;
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

  /* Pour les choix, on affiche le label plutôt que la valeur. */
  const answerLabel =
    answer !== null
      ? (interaction.options?.find((option) => option.value === answer)
          ?.label ?? answer)
      : null;

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

      {status === "pending" &&
        (hasOptions ? (
          <div className="flex flex-wrap gap-2">
            {interaction.options!.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant="outline"
                disabled={processing}
                onClick={() => onAnswer(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
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
        ))}

      {status === "answered" && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
          <Check className="size-4 text-green-500" />

          <span className="text-muted-foreground">Votre réponse</span>

          {answerLabel !== null ? (
            <span className="rounded-md bg-primary px-2.5 py-1 text-primary-foreground">
              {answerLabel}
            </span>
          ) : (
            <span className="text-muted-foreground">envoyée</span>
          )}
        </div>
      )}

      {status === "cancelled" && (
        <p className="border-t pt-3 text-sm text-muted-foreground">
          Question annulée.
        </p>
      )}

      {error && status === "pending" && (
        <p className="text-xs text-destructive">{error}</p>
      )}
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

  /* ---- Approvals ---- */

  const [processingApprovalId, setProcessingApprovalId] = useState<
    string | null
  >(null);

  /*
   * Décisions prises (ici ou ailleurs), avec un instantané de l'approval :
   * la carte reste affichée même quand le hook la retire de la liste live.
   */
  const [approvalDecisions, setApprovalDecisions] = useState<
    Record<string, ApprovalDecision>
  >({});

  /* ---- Interactions ---- */

  /* Interaction reçue en temps réel (SSE / WebSocket). */
  const [pendingInteraction, setPendingInteraction] =
    useState<ActiveInteraction | null>(null);

  /* Cartes reçues en temps réel, indexées par interactionKey. */
  const [liveInteractions, setLiveInteractions] = useState<
    Record<string, ActiveInteraction>
  >({});

  /* Réponses envoyées ici, indexées par interactionKey. */
  const [answeredInteractions, setAnsweredInteractions] = useState<
    Record<string, string>
  >({});

  const [processingInteraction, setProcessingInteraction] =
    useState(false);

  const [interactionError, setInteractionError] = useState<
    string | null
  >(null);

  /* ---------------------------------------------------------------------- */
  /*  Données dérivées                                                      */
  /* ---------------------------------------------------------------------- */

  const isAnswered = (key: string) => key in answeredInteractions;

  /* Sécurité : un même message ne doit jamais apparaître deux fois. */
  const messages = rawMessages.filter(
    (message, index) =>
      rawMessages.findIndex((other) => other.id === message.id) === index,
  );

  /* ---- Interactions portées par les messages ---- */

  /*
   * Une interaction ne doit produire qu'une seule carte, même si
   * plusieurs messages la portent (doublon SSE + base, etc.).
   * Le premier message est propriétaire de la carte.
   */
  const interactionInfo: Record<string, InteractionInfo> = {};
  const messageInteractionKeys: string[] = [];

  for (const message of messages) {
    const item = message.interaction;

    if (!item) {
      continue;
    }

    const questionKey = interactionKey(item.runId, item.question);
    const key = message.interactionId ?? questionKey;
    const status = toInteractionStatus(item.status);
    const answer = getInteractionAnswer(item);

    messageInteractionKeys.push(questionKey);

    const existing = interactionInfo[key];

    if (!existing) {
      interactionInfo[key] = { ownerId: message.id, status, answer };
    } else if (existing.status === "pending" && status !== "pending") {
      existing.status = status;
      existing.answer = answer ?? existing.answer;
    } else if (existing.answer === null && answer !== null) {
      existing.answer = answer;
    }
  }

  /* Cartes reçues en temps réel pas encore portées par un message. */
  const liveCards = Object.entries(liveInteractions).filter(
    ([key]) => !messageInteractionKeys.includes(key),
  );

  /* Bulles de l'agent qui répètent la question d'une carte live. */
  const hiddenBubbleIds: string[] = [];

  for (const [, live] of liveCards) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const candidate = messages[i];

      if (
        candidate.role !== "user" &&
        candidate.content.trim() === live.interaction.question.trim()
      ) {
        hiddenBubbleIds.push(candidate.id);
        break;
      }
    }
  }

  /* Dernière interaction encore en attente (historique). */
  let persistedInteraction: ActiveInteraction | null = null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const item = messages[i].interaction;

    if (!item) {
      continue;
    }

    const key = messages[i].interactionId ?? interactionKey(item.runId, item.question);

    if (
      interactionInfo[key]?.status === "pending" &&
      !isAnswered(interactionKey(item.runId, item.question))
    ) {
      persistedInteraction = {
        interaction: toUserInteraction(item),
        runId: item.runId,
      };

      break;
    }
  }

  /* L'interaction temps réel prend priorité sur celle de la base. */
  const activeInteraction = pendingInteraction ?? persistedInteraction;

  /* ---- Approvals ---- */

  const getApprovalStatus = (
    approvalId: string,
    dbStatus?: string,
  ): ApprovalStatus => {
    const decision = approvalDecisions[approvalId]?.status;

    if (decision === "approved" || decision === "rejected") {
      return decision;
    }

    if (dbStatus === "approved") return "approved";
    if (dbStatus === "rejected") return "rejected";

    return decision ?? "pending";
  };

  /*
   * Une approval ne doit produire qu'une seule carte, même si plusieurs
   * messages y font référence : le premier message en est propriétaire.
   */
  const approvalOwner: Record<string, string> = {};

  for (const message of messages) {
    const id = message.approval?.id ?? message.approvalId;

    if (id && !(id in approvalOwner)) {
      approvalOwner[id] = message.id;
    }
  }

  /* Approvals connues hors historique : temps réel + instantanés. */
  const knownApprovals: ApprovalView[] = [...approvals];

  for (const decision of Object.values(approvalDecisions)) {
    if (!knownApprovals.some((item) => item.id === decision.approval.id)) {
      knownApprovals.push(decision.approval);
    }
  }

  /* Approvals qu'aucun message ne porte (encore) : affichées à la fin. */
  const orphanApprovals = knownApprovals.filter(
    (approval) =>
      !messages.some(
        (message) =>
          message.approvalId === approval.id ||
          message.approval?.id === approval.id,
      ),
  );

  /* Nombre d'approvals encore en attente (pour le statut d'exécution). */
  let pendingApprovalCount = 0;

  const countedApprovalIds: string[] = [];

  for (const message of messages) {
    if (message.approval) {
      countedApprovalIds.push(message.approval.id);

      if (
        getApprovalStatus(message.approval.id, message.approval.status) ===
        "pending"
      ) {
        pendingApprovalCount++;
      }
    }
  }

  for (const approval of knownApprovals) {
    if (
      !countedApprovalIds.includes(approval.id) &&
      getApprovalStatus(approval.id) === "pending"
    ) {
      pendingApprovalCount++;
    }
  }

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
       * Le message référence une interaction / approval mais ne l'embarque
       * pas : on recharge l'historique pour récupérer la version complète.
       */
      if (
        (message.interactionId && !message.interaction) ||
        (message.approvalId && !message.approval)
      ) {
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
        [interactionKey(runId, interaction.question)]: {
          interaction,
          runId,
        },
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
      const resolved: unknown = args[0];

      if (typeof resolved === "string") {
        const known = approvals.find((item) => item.id === resolved);

        if (known) {
          setApprovalDecisions((previous) =>
            previous[resolved]
              ? previous
              : {
                  ...previous,
                  [resolved]: { status: "resolved", approval: known },
                },
          );
        }
      }

      removeApproval(...args);

      void refresh();
    },
    [approvals, removeApproval, refresh],
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

  const handleDecision = async (
    approval: ApprovalView,
    decision: "approved" | "rejected",
  ) => {
    if (processingApprovalId) {
      return;
    }

    setProcessingApprovalId(approval.id);

    try {
      if (decision === "approved") {
        await approve(approval.id);
      } else {
        await reject(approval.id);
      }

      setApprovalDecisions((previous) => ({
        ...previous,
        [approval.id]: { status: decision, approval },
      }));

      void refresh();
    } catch (error) {
      console.error(`[APPROVAL] Failed to ${decision}:`, error);
    } finally {
      setProcessingApprovalId(null);
    }
  };

  /*
   * La réponse est envoyée pour l'interaction cliquée (runId + question),
   * pas forcément pour activeInteraction.
   */
  const handleInteractionAnswer = async (
    runId: string,
    question: string,
    answer: string,
  ) => {
    const key = interactionKey(runId, question);

    if (processingInteraction || isAnswered(key)) {
      return;
    }

    setProcessingInteraction(true);
    setInteractionError(null);

    try {
      await resumeUserInteraction(runId, answer);

      setAnsweredInteractions((previous) => ({
        ...previous,
        [key]: answer,
      }));

      setPendingInteraction((current) =>
        current &&
        interactionKey(current.runId, current.interaction.question) === key
          ? null
          : current,
      );

      void refresh();
    } catch (error) {
      console.error("[INTERACTION] Failed to send answer:", error);

      setInteractionError("Impossible d'envoyer la réponse. Réessayez.");
    } finally {
      setProcessingInteraction(false);
    }
  };

  /* Défilement automatique vers le dernier élément. */
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollSignal =
    messages.length + knownApprovals.length + liveCards.length;

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
            knownApprovals.length === 0 &&
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

            /* Approval : base d'abord, sinon temps réel / instantané. */
            const approval: ApprovalView | null =
              message.approval ??
              knownApprovals.find(
                (item) => item.id === message.approvalId,
              ) ??
              null;

            const approvalStatus = approval
              ? getApprovalStatus(approval.id, message.approval?.status)
              : "pending";

            /* Une seule carte par approval. */
            const isApprovalOwner =
              !!approval && approvalOwner[approval.id] === message.id;

            /* Interaction */
            const interaction = message.interaction ?? null;

            const questionKey = interaction
              ? interactionKey(interaction.runId, interaction.question)
              : null;

            const info = interaction
              ? interactionInfo[
                  message.interactionId ?? (questionKey as string)
                ]
              : undefined;

            /* Une seule carte par interaction. */
            const isCardOwner = !!info && info.ownerId === message.id;

            const localAnswer =
              questionKey !== null
                ? answeredInteractions[questionKey]
                : undefined;

            /* Statut : la base fait foi, sinon la réponse envoyée ici. */
            const cardStatus: InteractionStatus =
              info && info.status !== "pending"
                ? info.status
                : localAnswer !== undefined
                  ? "answered"
                  : "pending";

            const cardAnswer = info?.answer ?? localAnswer ?? null;

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

                {approval && isApprovalOwner && (
                  <ApprovalCard
                    approval={approval}
                    status={approvalStatus}
                    processing={processingApprovalId === approval.id}
                    disabled={processingApprovalId !== null}
                    onApprove={() =>
                      void handleDecision(approval, "approved")
                    }
                    onReject={() =>
                      void handleDecision(approval, "rejected")
                    }
                  />
                )}

                {interaction && isCardOwner && (
                  <InteractionCard
                    interaction={toUserInteraction(interaction)}
                    status={cardStatus}
                    answer={cardAnswer}
                    processing={processingInteraction}
                    error={interactionError}
                    onAnswer={(answer) =>
                      void handleInteractionAnswer(
                        interaction.runId,
                        interaction.question,
                        answer,
                      )
                    }
                  />
                )}
              </div>
            );
          })}

          {/* Interactions reçues en temps réel, pas encore dans l'historique */}
          {liveCards.map(([key, live]) => (
            <InteractionCard
              key={key}
              interaction={live.interaction}
              status={isAnswered(key) ? "answered" : "pending"}
              answer={answeredInteractions[key] ?? null}
              processing={processingInteraction}
              error={interactionError}
              onAnswer={(answer) =>
                void handleInteractionAnswer(
                  live.runId,
                  live.interaction.question,
                  answer,
                )
              }
            />
          ))}

          {/* Approvals reçues en temps réel, pas encore dans l'historique */}
          {orphanApprovals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              status={getApprovalStatus(approval.id)}
              processing={processingApprovalId === approval.id}
              disabled={processingApprovalId !== null}
              onApprove={() => void handleDecision(approval, "approved")}
              onReject={() => void handleDecision(approval, "rejected")}
            />
          ))}

          {/* Runtime status */}
          {runtimeStatus &&
            pendingApprovalCount === 0 &&
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
