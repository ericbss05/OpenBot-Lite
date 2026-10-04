"use client";

/**
 * 📁 Emplacement : app/agents/new/_components/createAgentForm.tsx
 * 📄 Spécifique à la page /agents/new — ne pas importer depuis ailleurs.
 * (Formulaire en sections : assemble les blocs réutilisables avec les textes de la création.)
 */

import { Lock } from "lucide-react";

import {
  AgentBehaviorFields,
  AgentConnectionFields,
  AgentIdentityFields,
} from "@/components/agents/agentFormFields";
import { AvatarPicker } from "@/components/agents/avatarPicker";
import { FormActions } from "@/components/shared/formActions";
import { FormError } from "@/components/shared/formError";
import { FormSection } from "@/components/shared/formSection";
import { InfoPanel } from "@/components/shared/infoPanel";
import { Card } from "@/components/ui/card";

import type { CreateAgentState } from "@/hooks/useCreateAgent";

type CreateAgentFormProps = {
  state: CreateAgentState;
};

export function CreateAgentForm({
  state,
}: CreateAgentFormProps) {
  const {
    values,
    setField,
    avatar,
    loading,
    error,
    canSubmit,
    handleSubmit,
  } = state;

  return (
    <form onSubmit={handleSubmit}>
      <Card className="gap-0 divide-y overflow-hidden rounded-2xl py-0">
        <FormSection
          title="Identity"
          description="How your agent is presented in your list."
        >
          <AvatarPicker
            palette={avatar.palette}
            reversed={avatar.reversed}
            onShuffle={avatar.shuffle}
            disabled={loading}
          />

          <AgentIdentityFields
            values={values}
            onChange={setField}
            disabled={loading}
          />
        </FormSection>

        <FormSection
          title="Behavior"
          description="Tell the agent what it should do."
        >
          <AgentBehaviorFields
            values={values}
            onChange={setField}
            disabled={loading}
          />
        </FormSection>

        <FormSection
          title="Model"
          description="Choose the model used by your agent."
        >
          <div className="space-y-2">
            <label
              htmlFor="model"
              className="text-sm font-medium"
            >
              Model
            </label>

            <select
              id="model"
              value="gpt-6-luna"
              disabled
              className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="gpt-6-luna">
                OpenAI — GPT-6 Luna
              </option>
            </select>

            <p className="text-xs text-muted-foreground">
              More models will be available later.
            </p>
          </div>
        </FormSection>

        <FormSection
          title="Connection"
          description="Link the agent to a runtime, if you have one."
        >
          <AgentConnectionFields
            values={values}
            onChange={setField}
            disabled={loading}
          />
        </FormSection>

        <FormSection title="Access">
          <InfoPanel
            icon={<Lock className="size-4" />}
            title="Private agent"
            description="This agent belongs to you and is only accessible from your account."
          />
        </FormSection>

        <div className="space-y-4 bg-muted/40 px-6 py-4">
          {error && (
            <FormError message={error} />
          )}

          <FormActions
            cancelHref="/agents"
            submitLabel="Create agent"
            loadingLabel="Creating..."
            loading={loading}
            submitDisabled={!canSubmit}
          />
        </div>
      </Card>
    </form>
  );
}
