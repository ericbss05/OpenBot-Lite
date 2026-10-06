import { API_URL } from "@/lib/api/client";

export type HumanComputerAction =
  | {
      action: "click";
      x: number;
      y: number;
      button?: "left" | "right" | "wheel";
    }
  | {
      action: "double_click";
      x: number;
      y: number;
    }
  | {
      action: "scroll";
      x: number;
      y: number;
      scrollX?: number;
      scrollY: number;
    }
  | {
      action: "type";
      text: string;
    }
  | {
      action: "keypress";
      keys: string[];
    }
  | {
      action: "drag";
      path: [number, number][];
    };

export type HumanComputerActionResult = {
  action?: string;
  screenshot?: string;
  dimensions?: [number, number];
  environment?: string;
};

export type HumanComputerActionResponse = {
  success: boolean;
  runId: string;
  result?: HumanComputerActionResult;
  error?: string;
};

export type ResumeHumanControlResponse = {
  success: boolean;
  runId: string;
  result?: unknown;
  error?: string;
};

async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: unknown;
    };

    if (
      typeof body.error === "string" &&
      body.error.length > 0
    ) {
      return body.error;
    }
  } catch {
    // Ignore invalid JSON responses.
  }

  return fallback;
}

export async function executeHumanComputerAction(
  runId: string,
  action: HumanComputerAction,
): Promise<HumanComputerActionResponse> {
  const response = await fetch(
    `${API_URL}/api/human-control/${encodeURIComponent(runId)}/action`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(action),
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Impossible d'exécuter l'action sur l'ordinateur.",
      ),
    );
  }

  return (await response.json()) as HumanComputerActionResponse;
}

export async function resumeHumanControl(
  runId: string,
): Promise<ResumeHumanControlResponse> {
  const response = await fetch(
    `${API_URL}/api/human-control/${encodeURIComponent(runId)}/resume`,
    {
      method: "POST",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Impossible de redonner le contrôle à l'IA.",
      ),
    );
  }

  return (await response.json()) as ResumeHumanControlResponse;
}

export type DesktopStreamResponse = {
  url: string;
};

export async function getDesktopStreamUrl(
  agentId: string,
): Promise<DesktopStreamResponse> {
  const url =
    `${API_URL}/api/agents/${encodeURIComponent(agentId)}/stream`;

  console.log(
    "[VM DESKTOP] Requesting:",
    url,
  );

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  console.log(
    "[VM DESKTOP] Response:",
    response.status,
    response.statusText,
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Impossible de récupérer la session desktop.",
      ),
    );
  }

  const result =
    (await response.json()) as DesktopStreamResponse;

  console.log(
    "[VM DESKTOP] Stream URL received:",
    Boolean(result.url),
  );

  return result;
}