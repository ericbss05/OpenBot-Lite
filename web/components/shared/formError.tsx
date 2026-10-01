import { AlertCircle } from "lucide-react";

type FormErrorProps = {
  message: string;
};

export function FormError({
  message,
}: FormErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />

      <p className="leading-5">
        {message}
      </p>
    </div>
  );
}