"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  getDesktopStreamUrl,
  resumeHumanControl,
} from "@/lib/api/human-control";

type ComputerControlMode =
  | "ai"
  | "human_required"
  | "human";

type VmDesktopProps = {
  agentId: string;
  events?: unknown[];
  computerActive?: boolean;
  computerControlMode?: ComputerControlMode;
  humanControlRequest?: unknown;
};

type DesktopStatus =
  | "inactive"
  | "loading"
  | "active"
  | "error";

function extractRunId(
  request: unknown,
): string | null {
  if (
    typeof request !== "object" ||
    request === null
  ) {
    return null;
  }

  const value =
    request as Record<string, unknown>;

  if (
    typeof value.runId === "string" &&
    value.runId.length > 0
  ) {
    return value.runId;
  }

  if (
    typeof value.id === "string" &&
    value.type === "human_control_required"
  ) {
    return value.id;
  }

  if (
    typeof value.request === "object" &&
    value.request !== null
  ) {
    const nested =
      value.request as Record<
        string,
        unknown
      >;

    if (
      typeof nested.runId === "string" &&
      nested.runId.length > 0
    ) {
      return nested.runId;
    }
  }

  return null;
}

function getStatusLabel(
  status: DesktopStatus,
  computerActive: boolean,
  computerControlMode:
    | ComputerControlMode
    | undefined,
): string {
  if (status === "loading") {
    return "Connexion...";
  }

  if (status === "error") {
    return "Erreur";
  }

  if (!computerActive) {
    return "Inactif";
  }

  if (
    computerControlMode ===
    "human_required"
  ) {
    return "Contrôle humain requis";
  }

  if (
    computerControlMode === "human"
  ) {
    return "Contrôle humain";
  }

  if (
    computerControlMode === "ai"
  ) {
    return "Contrôle IA";
  }

  if (status === "active") {
    return "Actif";
  }

  return "Inactif";
}

export function VmDesktop({
  agentId,
  events: _events,
  computerActive = false,
  computerControlMode = "ai",
  humanControlRequest,
}: VmDesktopProps) {
  const [
    status,
    setStatus,
  ] =
    useState<DesktopStatus>(
      "inactive",
    );

  const [
    streamUrl,
    setStreamUrl,
  ] =
    useState<string | null>(
      null,
    );

  const [
    isOpen,
    setIsOpen,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    );

  const [
    resumingAi,
    setResumingAi,
  ] =
    useState(false);

  const runId = useMemo(
    () =>
      extractRunId(
        humanControlRequest,
      ),
    [humanControlRequest],
  );

  const statusLabel =
    getStatusLabel(
      status,
      computerActive,
      computerControlMode,
    );

  const humanControlActive =
    computerControlMode ===
    "human";

  const humanControlRequired =
    computerControlMode ===
    "human_required";

  const canReturnControlToAi =
    humanControlActive ||
    humanControlRequired;

  const connectDesktop =
    async () => {
      if (!agentId) {
        setErrorMessage(
          "Aucun agent associé à ce channel.",
        );

        setStatus("error");

        return;
      }

      if (status === "loading") {
        return;
      }

      setStatus("loading");
      setErrorMessage(null);

      try {
        console.log(
          "[VM DESKTOP] Connexion au desktop",
          {
            agentId,
          },
        );

        const result =
          await getDesktopStreamUrl(
            agentId,
          );

        if (!result.url) {
          throw new Error(
            "L'URL du stream desktop est vide.",
          );
        }

        setStreamUrl(
          result.url,
        );

        setStatus("active");

        console.log(
          "[VM DESKTOP] Desktop connecté",
          {
            agentId,
          },
        );
      } catch (error) {
        console.error(
          "[VM DESKTOP] Failed to connect:",
          error,
        );

        setStatus("error");

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de récupérer le desktop.",
        );
      }
    };

  const handleResumeAi =
    async () => {
      if (!runId) {
        setErrorMessage(
          "Aucun runId de contrôle humain disponible.",
        );

        return;
      }

      if (resumingAi) {
        return;
      }

      setResumingAi(true);
      setErrorMessage(null);

      try {
        console.log(
          "[VM DESKTOP] Redonner le contrôle à l'IA",
          {
            runId,
          },
        );

        await resumeHumanControl(
          runId,
        );

        console.log(
          "[VM DESKTOP] Contrôle rendu à l'IA",
          {
            runId,
          },
        );
      } catch (error) {
        console.error(
          "[VM DESKTOP] Failed to resume AI:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de redonner le contrôle à l'IA.",
        );
      } finally {
        setResumingAi(false);
      }
    };

  const handleOpenDesktop =
    () => {
      if (!streamUrl) {
        return;
      }

      setIsOpen(true);
    };

  return (
    <>
      <section className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              Desktop
            </div>

            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              Agent : {agentId}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className={
                  status === "active" &&
                  computerActive
                    ? "size-2 rounded-full bg-green-500"
                    : status === "error"
                      ? "size-2 rounded-full bg-red-500"
                      : "size-2 rounded-full bg-muted-foreground"
                }
              />

              {statusLabel}
            </span>
          </div>
        </div>

        {/* Desktop */}
        <div className="min-h-0 flex-1 overflow-hidden p-3">
          {!streamUrl &&
            status !== "loading" &&
            status !== "error" && (
              <div className="flex h-full min-h-52 flex-col items-center justify-center rounded-lg border border-dashed">
                <div className="text-sm font-medium">
                  Desktop non activé
                </div>

                <div className="mt-1 max-w-[16rem] text-center text-xs text-muted-foreground">
                  Active le desktop pour afficher
                  la session E2B de l&apos;agent.
                </div>

                <button
                  type="button"
                  onClick={
                    connectDesktop
                  }
                  className="mt-4 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
                >
                  Activer le desktop
                </button>
              </div>
            )}

          {status ===
            "loading" && (
            <div className="flex h-full min-h-52 flex-col items-center justify-center rounded-lg border">
              <div className="text-sm font-medium">
                Connexion au desktop...
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                Ouverture de la session E2B
              </div>
            </div>
          )}

          {status ===
            "error" && (
            <div className="flex h-full min-h-52 flex-col items-center justify-center rounded-lg border border-destructive/30">
              <div className="text-sm font-medium text-destructive">
                Impossible d&apos;ouvrir le desktop
              </div>

              <div className="mt-2 max-w-[18rem] text-center text-xs text-muted-foreground">
                {errorMessage ??
                  "Une erreur est survenue."}
              </div>

              <button
                type="button"
                onClick={
                  connectDesktop
                }
                className="mt-4 rounded-md border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
              >
                Réessayer
              </button>
            </div>
          )}

          {streamUrl &&
            status ===
              "active" && (
              <div className="flex h-full min-h-0 flex-col gap-2">
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-black">
                  <iframe
                    src={streamUrl}
                    title="Desktop E2B de l'agent"
                    className="h-full w-full border-0"
                    allow="clipboard-read; clipboard-write"
                  />

                  {/*
                   * When the AI controls the computer,
                   * the preview should not become an accidental
                   * human-control surface.
                   */}
                  {!humanControlActive &&
                    !humanControlRequired && (
                      <div className="absolute inset-0 cursor-default" />
                    )}
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  {canReturnControlToAi &&
                    runId && (
                      <button
                        type="button"
                        onClick={
                          handleResumeAi
                        }
                        disabled={
                          resumingAi
                        }
                        className="w-full rounded-md border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {resumingAi
                          ? "Redonner le contrôle..."
                          : "Redonner le contrôle à l'IA"}
                      </button>
                    )}

                  <button
                    type="button"
                    onClick={
                      handleOpenDesktop
                    }
                    className="w-full rounded-md border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    Ouvrir le desktop
                  </button>
                </div>

                {errorMessage && (
                  <div className="rounded-md border border-destructive/30 px-3 py-2 text-xs text-destructive">
                    {errorMessage}
                  </div>
                )}
              </div>
            )}
        </div>
      </section>

      {/* Fullscreen / interactive desktop */}
      {isOpen &&
        streamUrl && (
          <div className="fixed inset-0 z-50 bg-black">
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">
                  Desktop de l&apos;agent
                </div>

                <div className="truncate text-xs text-white/60">
                  {agentId}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canReturnControlToAi &&
                  runId && (
                    <button
                      type="button"
                      onClick={
                        handleResumeAi
                      }
                      disabled={
                        resumingAi
                      }
                      className="rounded-md bg-white px-3 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resumingAi
                        ? "Reprise..."
                        : "Redonner le contrôle à l'IA"}
                    </button>
                  )}

                <button
                  type="button"
                  onClick={() =>
                    setIsOpen(false)
                  }
                  className="rounded-md border border-white/20 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/10"
                >
                  Fermer
                </button>
              </div>
            </div>

            <iframe
              src={streamUrl}
              title="Desktop E2B en plein écran"
              className="h-full w-full border-0 pt-14"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        )}
    </>
  );
}

