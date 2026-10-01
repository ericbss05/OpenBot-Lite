/**
 * 📁 Emplacement : components/shared/formSection.tsx
 * ♻️ Réutilisable (générique) — aucune notion métier, utilisable sur n'importe quelle page.
 */

import type { ReactNode } from "react";

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="space-y-5 px-6 py-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="space-y-5">{children}</div>
    </section>
  );
}