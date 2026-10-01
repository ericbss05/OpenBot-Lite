/**
 * 📁 Emplacement : components/agents/agentFormFields.tsx
 * ♻️ Réutilisable (domaine agents) — champs communs aux formulaires de création et d'édition,
 * découpés par groupe pour pouvoir les placer dans des sections différentes.
 */

import { FormField } from "@/components/shared/formField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type AgentFormValues = {
  name: string;
  title: string;
  roleDescription: string;
  endpoint: string;
};

type AgentFieldsProps = {
  values: AgentFormValues;
  onChange: <K extends keyof AgentFormValues>(
    field: K,
    value: AgentFormValues[K],
  ) => void;
  disabled?: boolean;
};

export function AgentIdentityFields({
  values,
  onChange,
  disabled,
}: AgentFieldsProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <FormField label="Name" htmlFor="name" required>
        <Input
          id="name"
          type="text"
          value={values.name}
          onChange={(event) => onChange("name", event.target.value)}
          placeholder="Research Agent"
          required
          disabled={disabled}
        />
      </FormField>

      <FormField label="Title" htmlFor="title" optional>
        <Input
          id="title"
          type="text"
          value={values.title}
          onChange={(event) => onChange("title", event.target.value)}
          placeholder="Research assistant"
          disabled={disabled}
        />
      </FormField>
    </div>
  );
}

export function AgentBehaviorFields({
  values,
  onChange,
  disabled,
}: AgentFieldsProps) {
  return (
    <FormField label="Role / Instructions" htmlFor="roleDescription" optional>
      <Textarea
        id="roleDescription"
        value={values.roleDescription}
        onChange={(event) => onChange("roleDescription", event.target.value)}
        placeholder="Describe what this agent should do..."
        rows={7}
        disabled={disabled}
        className="min-h-44 resize-none leading-6"
      />
    </FormField>
  );
}

export function AgentConnectionFields({
  values,
  onChange,
  disabled,
}: AgentFieldsProps) {
  return (
    <FormField
      label="Endpoint"
      htmlFor="endpoint"
      optional
      hint="Optional endpoint for connecting this agent to an external or local runtime."
    >
      <Input
        id="endpoint"
        type="url"
        value={values.endpoint}
        onChange={(event) => onChange("endpoint", event.target.value)}
        placeholder="https://example.com/agent"
        disabled={disabled}
      />
    </FormField>
  );
}