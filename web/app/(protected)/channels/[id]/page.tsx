"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { useChannels } from "@/hooks/useChannels";
import { useChannelMessages } from "@/hooks/useChannelMessages";

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
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Start a conversation.
              </p>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
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
              placeholder="Write a message..."
              disabled={sending}
              rows={3}
              className="w-full resize-none rounded-lg border bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />

            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={!content.trim() || sending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}