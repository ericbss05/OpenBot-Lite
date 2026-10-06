"use client";

import {
LoaderCircle,
Monitor,
RefreshCw,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDesktopStreamUrl } from "@/lib/api/human-control";

const TEST_AGENT_ID =
"32aba718-0c9d-4ddc-a6e6-b83f2583bd66";

type TestStatus =
| "idle"
| "loading"
| "connected"
| "error";

export default function TestPage() {
const [streamUrl, setStreamUrl] =
useState<string | null>(null);

const [status, setStatus] =
useState<TestStatus>("idle");

const [error, setError] =
useState<string | null>(null);

const connect = async () => {
setStatus("loading");
setError(null);
setStreamUrl(null);

console.log(
  "[DESKTOP TEST] Connecting with agent:",
  TEST_AGENT_ID,
);

try {
  const result =
    await getDesktopStreamUrl(
      TEST_AGENT_ID,
    );

  console.log(
    "[DESKTOP TEST] Stream response:",
    result,
  );

  if (!result.url) {
    throw new Error(
      "L'API n'a pas renvoyé d'URL de stream.",
    );
  }

  setStreamUrl(result.url);
  setStatus("connected");
} catch (cause) {
  console.error(
    "[DESKTOP TEST] Connection failed:",
    cause,
  );

  setStatus("error");

  setError(
    cause instanceof Error
      ? cause.message
      : "Impossible de connecter le desktop.",
  );
}

};

const reconnect = async () => {
await connect();
};

return ( <main className="flex min-h-dvh flex-col bg-background">
{/* Header */} <header className="flex h-14 shrink-0 items-center justify-between border-b px-5"> <div className="flex items-center gap-3"> <div className="flex size-8 items-center justify-center rounded-lg border bg-muted/40"> <Monitor className="size-4" /> </div>

      <div>
        <h1 className="text-sm font-semibold">
          Desktop Stream Test
        </h1>

        <p className="text-xs text-muted-foreground">
          Test isolé du stream E2B
        </p>
      </div>
    </div>

    <Badge
      variant={
        status === "connected"
          ? "default"
          : status === "error"
            ? "destructive"
            : "outline"
      }
    >
      {status === "connected"
        ? "Connecté"
        : status === "loading"
          ? "Connexion…"
          : status === "error"
            ? "Erreur"
            : "Inactif"}
    </Badge>
  </header>

  {/* Controls */}
  <section className="shrink-0 border-b p-5">
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium">
          Agent ID
        </p>

        <code className="mt-1 block break-all rounded-md bg-muted p-2 text-xs">
          {TEST_AGENT_ID}
        </code>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => {
            void connect();
          }}
          disabled={status === "loading"}
        >
          {status === "loading" ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Monitor className="size-4" />
          )}

          Connecter
        </Button>

        {streamUrl && (
          <Button
            variant="outline"
            onClick={() => {
              void reconnect();
            }}
            disabled={status === "loading"}
          >
            <RefreshCw className="size-4" />
            Reconnecter
          </Button>
        )}
      </div>

      {status === "idle" && (
        <p className="text-xs text-muted-foreground">
          Clique sur « Connecter » pour récupérer
          le stream de la session E2B.
        </p>
      )}

      {status === "loading" && (
        <p className="text-xs text-muted-foreground">
          Appel de{" "}
          <code>
            /api/agents/:agentId/stream
          </code>
          …
        </p>
      )}

      {status === "connected" && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-xs font-medium text-emerald-600">
            URL du stream reçue.
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Le desktop ci-dessous est directement
            interactif.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs font-medium text-destructive">
            Erreur de connexion
          </p>

          <p className="mt-1 break-words text-xs text-destructive/80">
            {error}
          </p>
        </div>
      )}
    </div>
  </section>

  {/* Desktop */}
  <section className="min-h-0 flex-1 bg-black p-5">
    <div className="relative h-full min-h-[500px] w-full overflow-hidden rounded-xl border bg-black">
      {streamUrl ? (
        <iframe
          key={streamUrl}
          title="E2B Desktop Test"
          src={streamUrl}
          className="absolute inset-0 h-full w-full border-0"
          allow="
            clipboard-read;
            clipboard-write;
            fullscreen
          "
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-full min-h-[500px] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <Monitor className="size-8 text-white/30" />

            <p className="text-sm text-white/60">
              Aucun desktop connecté
            </p>

            <p className="text-xs text-white/40">
              Clique sur « Connecter ».
            </p>
          </div>
        </div>
      )}
    </div>
  </section>
</main>

);
}
