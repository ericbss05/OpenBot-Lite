/**
 * 📁 Emplacement : app/agents/[id]/page.tsx
 * 📄 Spécifique à la page /agents/[id] — édition d'un agent existant.
 */

"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Lock, Trash2 } from "lucide-react";

import {
  AgentBehaviorFields,
  AgentConnectionFields,
  AgentIdentityFields,
  type AgentFormValues,
} from "@/components/agents/agentFormFields";
import { AgentAvatar } from "@/components/agents/agentAvatar";
import { FormActions } from "@/components/shared/formActions";
import { FormError } from "@/components/shared/formError";
import { FormSection } from "@/components/shared/formSection";
import { InfoPanel } from "@/components/shared/infoPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  deleteAgent,
  getAgent,
  updateAgent,
  type Agent,
} from "@/lib/api/agents";

const EMPTY_VALUES: AgentFormValues = {
  name: "",
  title: "",
  roleDescription: "",
  endpoint: "",
};

export default function AgentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const id = params.id;

  const [agent, setAgent] = useState<Agent | null>(null);

  const [values, setValues] =
    useState<AgentFormValues>(EMPTY_VALUES);

  const [avatarPalette, setAvatarPalette] = useState(0);
  const [avatarReversed, setAvatarReversed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAgent() {
      try {
        setLoading(true);
        setError("");

        const data = await getAgent(id);

        if (cancelled) {
          return;
        }

        setAgent(data);

        setValues({
          name: data.name,
          title: data.title ?? "",
          roleDescription: data.roleDescription ?? "",
          endpoint: data.endpoint ?? "",
        });

        setAvatarPalette(data.avatarPalette);
        setAvatarReversed(data.avatarReversed);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setAgent(null);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load agent.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAgent();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const setField = useCallback(
    <K extends keyof AgentFormValues>(
      field: K,
      value: AgentFormValues[K],
    ) => {
      setValues((current) => ({
        ...current,
        [field]: value,
      }));
    },
    [],
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const name = values.name.trim();

    if (!name) {
      setError("Agent name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const updatedAgent = await updateAgent(id, {
        name,
        title: values.title.trim() || undefined,
        roleDescription:
          values.roleDescription.trim() || undefined,
        endpoint: values.endpoint.trim() || undefined,
        visibility: "private",
        avatarPalette,
        avatarReversed,
      });

      setAgent(updatedAgent);

      setValues({
        name: updatedAgent.name,
        title: updatedAgent.title ?? "",
        roleDescription:
          updatedAgent.roleDescription ?? "",
        endpoint: updatedAgent.endpoint ?? "",
      });

      setAvatarPalette(updatedAgent.avatarPalette);
      setAvatarReversed(updatedAgent.avatarReversed);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update agent.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!agent) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${agent.name}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      await deleteAgent(id);

      router.push("/agents");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete agent.",
      );

      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/agents"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to agents
          </Link>

          <div className="mt-8">
            <p className="text-sm text-muted-foreground">
              Loading agent...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!agent) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/agents"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to agents
          </Link>

          <div className="mt-8">
            <h1 className="text-2xl font-semibold">
              Agent not found
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {error || "This agent does not exist."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/agents"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to agents
        </Link>

        <div className="mt-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Edit agent
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Update your agent configuration.
          </p>
        </div>

        <div className="mt-8">
          <form onSubmit={handleSubmit}>
            <Card className="gap-0 divide-y overflow-hidden rounded-2xl py-0">
              <FormSection
                title="Identity"
                description="How your agent is presented in your workspace."
              >
                <div className="flex items-center gap-4">
                  <div className="shrink-0 overflow-hidden rounded-xl">
                    <AgentAvatar
                      agentId="preview"
                      palette={avatarPalette}
                      reversed={avatarReversed}
                      size={56}
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Agent avatar
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Your current avatar is preserved while editing.
                    </p>
                  </div>
                </div>

                <AgentIdentityFields
                  values={values}
                  onChange={setField}
                  disabled={saving || deleting}
                />
              </FormSection>

              <FormSection
                title="Behavior"
                description="Tell the agent what it should do."
              >
                <AgentBehaviorFields
                  values={values}
                  onChange={setField}
                  disabled={saving || deleting}
                />
              </FormSection>

              <FormSection
                title="Connection"
                description="Link the agent to a runtime, if you have one."
              >
                <AgentConnectionFields
                  values={values}
                  onChange={setField}
                  disabled={saving || deleting}
                />
              </FormSection>

              <FormSection
                title="Access"
                description="Control who can access this agent."
              >
                <InfoPanel
                  icon={<Lock className="size-4" />}
                  title="Private agent"
                  description="This agent belongs to you and is only accessible from your account."
                />
              </FormSection>

              <div className="space-y-4 bg-muted/40 px-6 py-4">
                {error && <FormError message={error} />}

                <FormActions
                  cancelHref="/agents"
                  submitLabel="Save changes"
                  loadingLabel="Saving..."
                  loading={saving}
                  submitDisabled={
                    !values.name.trim() || deleting
                  }
                />
              </div>
            </Card>
          </form>

          <Card className="mt-6 rounded-2xl border-destructive/20">
            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <Trash2 className="size-4 text-destructive" />
                </div>

                <div>
                  <h2 className="text-sm font-semibold">
                    Delete agent
                  </h2>

                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    Permanently delete this agent and its
                    configuration. This action cannot be undone.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={saving || deleting}
                className="shrink-0"
              >
                {deleting ? "Deleting..." : "Delete agent"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}