"use client";

import {
type FormEvent,
useCallback,
useState,
} from "react";

import { useParams } from "next/navigation";

import { useChannelDetail } from "@/hooks/useChannelDetail";
import { useChannelMessages } from "@/hooks/useChannelMessages";
import { useChannelEvents } from "@/hooks/useChannelEvents";
import { useChannelApprovals } from "@/hooks/useChannelApprovals";

import {
resumeUserInteraction,
type ChannelMessage,
type UserInteraction,
} from "@/lib/api/channels";

export default function ChannelPage() {
const params = useParams<{
id: string;
}>();

const channelId = params.id;

const {
channel,
loading: channelLoading,
error: channelError,
} = useChannelDetail(channelId);

const {
messages,
loading: messagesLoading,
error: messagesError,
send,
appendMessage,
} = useChannelMessages(channelId);

const {
approvals,
addApproval,
removeApproval,
approve,
reject,
} = useChannelApprovals();

const [content, setContent] =
useState("");

const [sending, setSending] =
useState(false);

const [
processingApprovalId,
setProcessingApprovalId,
] = useState<string | null>(null);

const [
pendingInteraction,
setPendingInteraction,
] = useState<{
interaction: UserInteraction;
runId: string;
} | null>(null);

const [
processingInteraction,
setProcessingInteraction,
] = useState(false);

const handleMessageCreated =
useCallback(
(message: ChannelMessage) => {
appendMessage(message);
},
[appendMessage],
);

const handleUserInteractionRequired =
useCallback(
(
interaction: UserInteraction,
runId: string,
) => {
console.log(
"[INTERACTION] User interaction required:",
{
interaction,
runId,
},
);

    setPendingInteraction({
      interaction,
      runId,
    });
  },
  [],
);

const {
connected,
runtimeStatus,
} = useChannelEvents(
channelId,
{
onMessageCreated:
handleMessageCreated,

  onApprovalRequired:
    addApproval,

  onApprovalResolved:
    removeApproval,

  onUserInteractionRequired:
    handleUserInteractionRequired,
},

);

const handleSubmit = async (
event: FormEvent<HTMLFormElement>,
) => {
event.preventDefault();

const value =
  content.trim();

if (!value || sending) {
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

const handleApprove = async (
approvalId: string,
) => {
if (processingApprovalId) {
return;
}

setProcessingApprovalId(
  approvalId,
);

try {
  await approve(approvalId);
} catch (error) {
  console.error(
    "[APPROVAL] Failed to approve:",
    error,
  );
} finally {
  setProcessingApprovalId(null);
}

};

const handleReject = async (
approvalId: string,
) => {
if (processingApprovalId) {
return;
}

setProcessingApprovalId(
  approvalId,
);

try {
  await reject(approvalId);
} catch (error) {
  console.error(
    "[APPROVAL] Failed to reject:",
    error,
  );
} finally {
  setProcessingApprovalId(null);
}

};

const handleInteractionAnswer =
async (answer: string) => {
if (
!pendingInteraction ||
processingInteraction
) {
return;
}

  setProcessingInteraction(
    true,
  );

  try {
    console.log(
      "[INTERACTION] Sending answer:",
      {
        runId:
          pendingInteraction.runId,
        answer,
      },
    );

    await resumeUserInteraction(
      pendingInteraction.runId,
      answer,
    );

    setPendingInteraction(
      null,
    );
  } catch (error) {
    console.error(
      "[INTERACTION] Failed to send answer:",
      error,
    );
  } finally {
    setProcessingInteraction(
      false,
    );
  }
};

if (channelLoading) {
return ( <main className="p-6"> <p>Chargement...</p> </main>
);
}

if (channelError) {
return ( <main className="p-6"> <h1 className="text-lg font-semibold">
Erreur </h1>

    <p className="mt-2 text-sm text-muted-foreground">
      {channelError}
    </p>
  </main>
);

}

if (!channel) {
return ( <main className="p-6"> <p>
Channel introuvable. </p> </main>
);
}

return ( <main className="flex min-h-full flex-col">
{/* Header */} <header className="border-b border-white/10 px-6 py-4"> <div className="flex items-center justify-between gap-4"> <div> <h1 className="text-lg font-semibold">
{channel.name} </h1>

        <p className="mt-1 text-xs text-white/30">
          {channel.id}
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className={
            connected
              ? "h-2 w-2 rounded-full bg-green-400"
              : "h-2 w-2 rounded-full bg-white/20"
          }
        />

        <span className="text-white/40">
          {connected
            ? "Connecté"
            : "Déconnecté"}
        </span>
      </div>
    </div>
  </header>

  {/* Messages */}
  <section className="flex-1 overflow-y-auto px-6 py-6">
    <div className="mx-auto max-w-3xl">
      {messagesLoading && (
        <div className="text-sm text-white/40">
          Chargement des messages...
        </div>
      )}

      {messagesError && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
          {messagesError}
        </div>
      )}

      {!messagesLoading &&
        messages.length === 0 &&
        approvals.length === 0 &&
        !pendingInteraction && (
          <div className="py-16 text-center">
            <p className="text-sm text-white/40">
              Aucun message.
            </p>

            <p className="mt-1 text-xs text-white/20">
              Envoyez un message pour commencer.
            </p>
          </div>
        )}

      <div className="space-y-6">
        {/* Conversation */}
        {messages.map((message) => {
          const isUser =
            message.role === "user";

          return (
            <article
              key={message.id}
              className={
                isUser
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              <div
                className={
                  isUser
                    ? "max-w-[80%] rounded-2xl rounded-br-md bg-white px-4 py-3 text-black"
                    : "max-w-[80%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.03] px-4 py-3"
                }
              >
                <div
                  className={
                    isUser
                      ? "mb-1 text-[11px] font-medium text-black/50"
                      : "mb-1 text-[11px] font-medium text-white/30"
                  }
                >
                  {isUser
                    ? "Vous"
                    : "Agent"}
                </div>

                <p className="whitespace-pre-wrap text-sm leading-6">
                  {message.content}
                </p>
              </div>
            </article>
          );
        })}

        {/* Approvals */}
        {approvals.map((approval) => {
          const processing =
            processingApprovalId ===
            approval.id;

          return (
            <article
              key={approval.id}
              className="flex justify-start"
            >
              <div className="w-full max-w-[80%] rounded-2xl rounded-bl-md border border-yellow-500/20 bg-yellow-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-sm">
                    ⚠️
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-sm font-medium">
                      Approbation requise
                    </h2>

                    <p className="mt-1 text-xs text-white/40">
                      L&apos;agent souhaite exécuter
                      une action nécessitant votre
                      autorisation.
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="text-xs font-medium text-white/60">
                    {approval.toolId}
                  </div>

                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-white/40">
                    {JSON.stringify(
                      approval.arguments,
                      null,
                      2,
                    )}
                  </pre>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      processing ||
                      processingApprovalId !==
                        null
                    }
                    onClick={() =>
                      handleReject(
                        approval.id,
                      )
                    }
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {processing
                      ? "Traitement..."
                      : "Refuser"}
                  </button>

                  <button
                    type="button"
                    disabled={
                      processing ||
                      processingApprovalId !==
                        null
                    }
                    onClick={() =>
                      handleApprove(
                        approval.id,
                      )
                    }
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {processing
                      ? "Traitement..."
                      : "Autoriser"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {/* User interaction */}
        {pendingInteraction && (
          <article className="flex justify-start">
            <div className="w-full max-w-[80%] rounded-2xl rounded-bl-md border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm">
                  ?
                </div>

                <div className="min-w-0">
                  <h2 className="text-sm font-medium">
                    {pendingInteraction
                      .interaction.type ===
                    "clarification"
                      ? "Précision requise"
                      : "Votre choix"}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-white/70">
                    {
                      pendingInteraction
                        .interaction
                        .question
                    }
                  </p>
                </div>
              </div>

              {pendingInteraction
                .interaction.options &&
                pendingInteraction
                  .interaction
                  .options
                  .length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pendingInteraction.interaction.options.map(
                      (option) => (
                        <button
                          key={
                            option.value
                          }
                          type="button"
                          disabled={
                            processingInteraction
                          }
                          onClick={() =>
                            handleInteractionAnswer(
                              option.value,
                            )
                          }
                          className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {processingInteraction
                            ? "..."
                            : option.label}
                        </button>
                      ),
                    )}
                  </div>
                )}

              {(!pendingInteraction
                .interaction
                .options ||
                pendingInteraction
                  .interaction
                  .options
                  .length === 0) && (
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();

                    const form =
                      event.currentTarget;

                    const input =
                      form.elements.namedItem(
                        "answer",
                      ) as HTMLInputElement;

                    void handleInteractionAnswer(
                      input.value,
                    );
                  }}
                >
                  <input
                    name="answer"
                    type="text"
                    autoComplete="off"
                    disabled={
                      processingInteraction
                    }
                    placeholder="Votre réponse..."
                    className="min-h-10 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-white/20 disabled:opacity-40"
                  />

                  <button
                    type="submit"
                    disabled={
                      processingInteraction
                    }
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {processingInteraction
                      ? "..."
                      : "Répondre"}
                  </button>
                </form>
              )}
            </div>
          </article>
        )}

        {/* Runtime status */}
        {runtimeStatus &&
          approvals.length === 0 &&
          !pendingInteraction && (
            <div className="flex justify-start">
              <div className="flex items-center gap-3 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50" />

                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50 [animation-delay:150ms]" />

                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50 [animation-delay:300ms]" />
                </div>

                <span className="text-sm text-white/40">
                  {runtimeStatus}
                </span>
              </div>
            </div>
          )}
      </div>
    </div>
  </section>

  {/* Composer */}
  <section className="border-t border-white/10 px-6 py-4">
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-3xl items-end gap-3"
    >
      <textarea
        value={content}
        onChange={(event) =>
          setContent(event.target.value)
        }
        placeholder="Écrire un message..."
        disabled={sending}
        rows={1}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey
          ) {
            event.preventDefault();

            if (
              content.trim() &&
              !sending
            ) {
              event.currentTarget.form?.requestSubmit();
            }
          }
        }}
        className="min-h-12 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-white/20"
      />

      <button
        type="submit"
        disabled={
          sending ||
          !content.trim()
        }
        className="min-h-12 rounded-xl bg-white px-5 text-sm font-medium text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
      >
        {sending
          ? "..."
          : "Envoyer"}
      </button>
    </form>
  </section>
</main>

);
}
