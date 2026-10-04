"use client";

import Link from "next/link";
import { useAgents } from "@/hooks/useAgents";

export default function ChannelsPage() {
  const { agents, loading, error } = useAgents();

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-2xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted/50 text-2xl">
          ✦
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          Sélectionnez un agent pour commencer
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Choisissez un agent avec lequel vous souhaitez discuter.
        </p>

        {loading && (
          <div className="mt-8 text-sm text-muted-foreground">
            Chargement de vos agents…
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Impossible de charger vos agents.
          </div>
        )}

        {!loading && !error && agents.length === 0 && (
          <div className="mx-auto mt-8 max-w-md rounded-2xl border bg-card p-6">
            <div className="text-base font-medium">
              Aucun agent pour le moment
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Créez votre premier agent pour commencer à travailler avec
              Orbit.
            </p>

            <Link
              href="/agents"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Créer un agent
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
