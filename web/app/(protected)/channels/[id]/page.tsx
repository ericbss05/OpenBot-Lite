"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { useChannels } from "@/hooks/useChannels";
import { useChannelMessages } from "@/hooks/useChannelMessages";

type ApprovalRequest = {
  id: string;
  action: string;
  description: string;
  details: {
    name: string;
    role: string;
    tools: string[];
  };
};

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.id as string;

  const { channels } = useChannels();

  const {
    messages,
    loading: messagesLoading,
    sending,
    send,
  } = useChannelMessages(channelId);

  const [content, setContent] = useState("");

  const [approval, setApproval] =
    useState<ApprovalRequest | null>(null);

  const channel = channels.find(
    (item) => item.id === channelId,
  );

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const value = content.trim();

    if (!value || sending) return;

    await send(value);

    setContent("");

    /*
     * TEMPORAIRE :
     * On simule ici une demande d'autorisation
     * pour tester l'UI.
     *
     * Plus tard cette donnée viendra directement
     * du workflow backend lorsque le Gateway
     * retournera "approval_required".
     */
    if (
      value.toLowerCase().includes("crée") ||
      value.toLowerCase().includes("cree") ||
      value.toLowerCase().includes("créer") ||
      value.toLowerCase().includes("creer")
    ) {
      setApproval({
        id: crypto.randomUUID(),
        action: "create_sub_agent",
        description:
          "L'agent souhaite créer un nouvel agent spécialisé.",
        details: {
          name: "Prospecteur",
          role: "Spécialiste de la prospection commerciale",
          tools: [
            "calculator",
            "search_memory",
          ],
        },
      });
    }
  }

  function handleApprove() {
    /*
     * TEMPORAIRE :
     * Plus tard :
     * → appel API d'approbation
     * → reprise du workflow
     */
    setApproval(null);
  }

  function handleReject() {
    /*
     * TEMPORAIRE :
     * Plus tard :
     * → appel API de rejet
     * → reprise/fin du workflow
     */
    setApproval(null);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 min-w-0 flex-col">
      <header className="border-b px-6 py-4">
        <h1 className="font-semibold">
          {channel?.name ?? "Channel"}
        </h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messagesLoading ? (
            <div className="text-sm text-muted-foreground">
              Loading messages...
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              {messages.length === 0 && !approval ? (
                <div className="flex h-full min-h-64 items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    Start a conversation.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}

                  {approval && (
                    <div className="flex justify-start">
                      <div className="w-full max-w-xl overflow-hidden rounded-xl border bg-background">
                        <div className="border-b px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-600">
                              ⚠
                            </div>

                            <div>
                              <h2 className="font-semibold">
                                Authorization required
                              </h2>

                              <p className="mt-1 text-sm text-muted-foreground">
                                The agent wants to perform
                                an action that requires your
                                approval.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 px-5 py-5">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Action
                            </p>

                            <p className="mt-1 font-medium">
                              {approval.action}
                            </p>
                          </div>

                          <div>
                            <p className="text-sm text-muted-foreground">
                              {approval.description}
                            </p>
                          </div>

                          <div className="rounded-lg border bg-muted/30 p-4">
                            <div className="space-y-4">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">
                                  Agent name
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {approval.details.name}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-medium text-muted-foreground">
                                  Role
                                </p>

                                <p className="mt-1 text-sm">
                                  {approval.details.role}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-medium text-muted-foreground">
                                  Tools
                                </p>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  {approval.details.tools.map(
                                    (tool) => (
                                      <span
                                        key={tool}
                                        className="rounded-md border bg-background px-2 py-1 font-mono text-xs"
                                      >
                                        {tool}
                                      </span>
                                    ),
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                              type="button"
                              onClick={handleReject}
                              className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
                            >
                              Reject
                            </button>

                            <button
                              type="button"
                              onClick={handleApprove}
                              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4">
          <form
            onSubmit={handleSubmit}
            className="mx-auto w-full max-w-3xl"
          >
            <textarea
              value={content}
              onChange={(event) =>
                setContent(event.target.value)
              }
              placeholder="Ask your agent to do something..."
              disabled={sending}
              rows={3}
              className="w-full resize-none rounded-lg border bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />

            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={
                  !content.trim() || sending
                }
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending
                  ? "Sending..."
                  : "Send"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}