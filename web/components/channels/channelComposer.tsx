import type {
  FormEvent,
} from "react";

import {
  Loader2,
  SendHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChannelComposerProps = {
  content: string;
  sending: boolean;
  onChange: (
    value: string,
  ) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
};

export function ChannelComposer({
  content,
  sending,
  onChange,
  onSubmit,
}: ChannelComposerProps) {
  return (
    <section className="sticky bottom-0 border-t bg-background px-6 py-3">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex max-w-2xl items-end gap-2"
      >
        <Textarea
          value={content}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          placeholder="Écrire un message..."
          rows={1}
          onKeyDown={(event) => {
            if (
              event.key ===
                "Enter" &&
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
          className="max-h-40 min-h-10 resize-none"
        />

        <Button
          type="submit"
          size="icon"
          aria-label="Envoyer"
          disabled={
            sending ||
            !content.trim()
          }
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
  );
}