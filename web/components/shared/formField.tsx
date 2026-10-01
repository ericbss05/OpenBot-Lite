import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
};

export function FormField({
  label,
  htmlFor,
  required = false,
  optional = false,
  hint,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={htmlFor}>
          {label}

          {required && (
            <span className="ml-1 text-destructive">*</span>
          )}

          {optional && (
            <span className="ml-1 font-normal text-muted-foreground">
              (optional)
            </span>
          )}
        </Label>
      </div>

      {children}

      {hint && (
        <p className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}