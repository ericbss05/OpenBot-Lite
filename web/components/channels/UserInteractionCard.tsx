"use client";

import { useState } from "react";

import type { UserInteraction } from "@/lib/api/channels";

type UserInteractionCardProps = {
interaction: UserInteraction;
disabled?: boolean;
onAnswer: (answer: string) => void;
};

export function UserInteractionCard({
interaction,
disabled = false,
onAnswer,
}: UserInteractionCardProps) {
const [customAnswer, setCustomAnswer] =
useState("");

const hasOptions =
Boolean(interaction.options?.length);

const submitCustomAnswer = () => {
const answer = customAnswer.trim();

if (!answer || disabled) {
  return;
}

onAnswer(answer);
setCustomAnswer("");

};

return ( <div className="rounded-2xl border bg-card p-4 shadow-sm"> <div className="mb-3"> <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
{interaction.type === "clarification"
? "Clarification"
: "Question"} </div>

```
    <p className="text-sm leading-6">
      {interaction.question}
    </p>
  </div>

  {hasOptions && (
    <div className="flex flex-wrap gap-2">
      {interaction.options?.map(
        (option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() =>
              onAnswer(option.value)
            }
            className="rounded-lg border px-3 py-2 text-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {option.label}
          </button>
        ),
      )}
    </div>
  )}

  <div className="mt-3 flex gap-2">
    <input
      value={customAnswer}
      onChange={(event) =>
        setCustomAnswer(
          event.target.value,
        )
      }
      onKeyDown={(event) => {
        if (
          event.key === "Enter"
        ) {
          submitCustomAnswer();
        }
      }}
      disabled={disabled}
      placeholder="Ou écris ta réponse..."
      className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2"
    />

    <button
      type="button"
      disabled={
        disabled ||
        !customAnswer.trim()
      }
      onClick={
        submitCustomAnswer
      }
      className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      Répondre
    </button>
  </div>
</div>

);
}
