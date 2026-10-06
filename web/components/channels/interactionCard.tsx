import {
  type FormEvent,
  useState,
} from "react";

import {
  Check,
  Loader2,
  MessageCircleQuestion,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type {
  InteractionStatus,
} from "./types";

import type {
  UserInteraction,
} from "@/lib/api/channels";

type InteractionCardProps = {
  interaction: UserInteraction;
  status: InteractionStatus;
  answer: string | null;
  processing: boolean;
  error: string | null;
  onAnswer: (
    answer: string,
  ) => void;
};

export function InteractionCard({
  interaction,
  status,
  answer,
  processing,
  error,
  onAnswer,
}: InteractionCardProps) {
  const [
    text,
    setText,
  ] = useState("");

  const hasOptions =
    !!interaction.options &&
    interaction.options.length > 0;

  const title =
    interaction.type ===
    "clarification"
      ? "Précision requise"
      : "Votre choix";

  const answerLabel =
    answer !== null
      ? (
          interaction.options?.find(
            (option) =>
              option.value ===
              answer,
          )?.label ??
          answer
        )
      : null;

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const value =
      text.trim();

    if (
      !value ||
      processing
    ) {
      return;
    }

    onAnswer(value);
  };

  return (
    <Card className="flex max-w-[85%] flex-col gap-4 p-4 shadow-none">
      <div className="flex items-start gap-3">
        <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {title}
          </p>

          <p className="mt-1 text-sm leading-6">
            {interaction.question}
          </p>
        </div>
      </div>

      {status === "pending" &&
        (hasOptions ? (
          <div className="flex flex-wrap gap-2">
            {interaction.options!.map(
              (option) => (
                <Button
                  key={
                    option.value
                  }
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    processing
                  }
                  onClick={() =>
                    onAnswer(
                      option.value,
                    )
                  }
                >
                  {option.label}
                </Button>
              ),
            )}
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={
              handleSubmit
            }
          >
            <Input
              name="answer"
              type="text"
              autoComplete="off"
              value={text}
              onChange={(
                event,
              ) =>
                setText(
                  event.target.value,
                )
              }
              disabled={
                processing
              }
              placeholder="Votre réponse..."
            />

            <Button
              type="submit"
              disabled={
                processing ||
                !text.trim()
              }
            >
              {processing && (
                <Loader2 className="animate-spin" />
              )}
              Répondre
            </Button>
          </form>
        ))}

      {status ===
        "answered" && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
          <Check className="size-4 text-green-500" />

          <span className="text-muted-foreground">
            Votre réponse
          </span>

          {answerLabel !== null ? (
            <span className="rounded-md bg-primary px-2.5 py-1 text-primary-foreground">
              {answerLabel}
            </span>
          ) : (
            <span className="text-muted-foreground">
              envoyée
            </span>
          )}
        </div>
      )}

      {status ===
        "cancelled" && (
        <p className="border-t pt-3 text-sm text-muted-foreground">
          Question annulée.
        </p>
      )}

      {error &&
        status ===
          "pending" && (
          <p className="text-xs text-destructive">
            {error}
          </p>
        )}
    </Card>
  );
}