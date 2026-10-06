import type { Sandbox } from "@e2b/desktop";

const DESKTOP_DIMENSIONS: [number, number] = [
  1280,
  800,
];

function normalizeKey(key: string): string {
  const lower = key.toLowerCase();

  if (lower === "return") return "enter";
  if (lower === "arrowup") return "up";
  if (lower === "arrowdown") return "down";
  if (lower === "arrowleft") return "left";
  if (lower === "arrowright") return "right";

  return lower;
}

function isAuthKeyUnavailableError(
  error: unknown,
): boolean {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const normalized =
    message.toLowerCase();

  return (
    normalized.includes(
      "unable to retrieve stream auth key",
    ) ||
    normalized.includes(
      "check if requireauth is enabled",
    ) ||
    normalized.includes(
      "requireauth is enabled",
    )
  );
}

function isStreamAlreadyRunningError(
  error: unknown,
): boolean {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const normalized =
    message.toLowerCase();

  return (
    normalized.includes(
      "stream is already running",
    ) ||
    normalized.includes(
      "already running",
    ) ||
    normalized.includes(
      "stream already running",
    )
  );
}

export class E2BDesktopComputer {
  readonly environment = "browser" as const;

  readonly dimensions = DESKTOP_DIMENSIONS;

  constructor(
    private readonly sandbox: Sandbox,
  ) {}

  async launchBrowser(): Promise<void> {
    await this.sandbox.launch(
      "google-chrome",
    );

    await this.sandbox.wait(1500);
  }

  /**
   * Returns the URL of the E2B live desktop stream.
   *
   * The stream must use authentication because the URL is
   * ultimately exposed to the frontend.
   *
   * Cases handled:
   *
   * 1. Stream running + auth enabled
   *    -> reuse the existing auth key.
   *
   * 2. Stream not running
   *    -> start it with requireAuth=true.
   *
   * 3. Stream running + auth disabled
   *    -> stop it, restart it with requireAuth=true,
   *       then retrieve the new auth key.
   *
   * `viewOnly=true` keeps the same live stream but disables
   * user interaction through the rendered desktop.
   */
  async getStreamUrl(
    viewOnly = false,
  ): Promise<string> {
    let authKey:
      | string
      | undefined;

    /*
     * First attempt:
     *
     * If the stream is already running with authentication
     * enabled, this is enough and we reuse the existing stream.
     */
    try {
      authKey =
        await this.sandbox.stream.getAuthKey();
    } catch (error) {
      /*
       * If this is not the "requireAuth is not enabled" case,
       * do not hide the original error.
       */
      if (
        !isAuthKeyUnavailableError(error)
      ) {
        throw error;
      }

      console.log(
        "[E2B DESKTOP] Stream actif sans authentification. Redémarrage avec requireAuth=true.",
      );

      /*
       * The stream may currently be running without auth.
       *
       * We first try to stop it.
       *
       * If it was actually not running anymore, we simply ignore
       * the stop error and proceed to start().
       */
      try {
        await this.sandbox.stream.stop();

        console.log(
          "[E2B DESKTOP] Ancien stream arrêté.",
        );
      } catch (stopError) {
        console.log(
          "[E2B DESKTOP] Aucun ancien stream à arrêter ou arrêt déjà effectué.",
          stopError instanceof Error
            ? stopError.message
            : String(stopError),
        );
      }

      /*
       * Start a fresh authenticated stream.
       */
      try {
        await this.sandbox.stream.start({
          requireAuth: true,
        });

        console.log(
          "[E2B DESKTOP] Nouveau stream authentifié démarré.",
        );
      } catch (startError) {
        /*
         * A concurrent request may have restarted the stream
         * between stop() and start().
         *
         * In that situation, try to reuse it.
         */
        if (
          !isStreamAlreadyRunningError(
            startError,
          )
        ) {
          throw startError;
        }

        console.log(
          "[E2B DESKTOP] Stream déjà actif après la tentative de redémarrage. Réutilisation.",
        );
      }

      /*
       * The stream is now expected to have requireAuth enabled.
       */
      authKey =
        await this.sandbox.stream.getAuthKey();
    }

    if (!authKey) {
      throw new Error(
        "E2B desktop stream authentication key is unavailable.",
      );
    }

    const url =
      this.sandbox.stream.getUrl({
        authKey,
        viewOnly,
      });

    console.log(
      "[E2B DESKTOP] URL du stream récupérée.",
      {
        viewOnly,
        authenticated: true,
      },
    );

    return url;
  }

  /**
   * Stops the live desktop stream.
   *
   * This does NOT destroy the sandbox.
   * The agent's persistent computer session remains available.
   */
  async stopStream(): Promise<void> {
    await this.sandbox.stream.stop();

    console.log(
      "[E2B DESKTOP] Stream arrêté.",
    );
  }

  async screenshot(): Promise<string> {
    const bytes =
      await this.sandbox.screenshot();

    return Buffer.from(bytes).toString(
      "base64",
    );
  }

  async click(
    x: number,
    y: number,
    button:
      | "left"
      | "right"
      | "wheel"
      | "back"
      | "forward",
  ): Promise<void> {
    if (button === "right") {
      await this.sandbox.rightClick(x, y);
      return;
    }

    if (button === "wheel") {
      await this.sandbox.middleClick(x, y);
      return;
    }

    /*
     * Keep the existing behavior for left, back and forward.
     * The current E2B wrapper uses a left click as its default
     * action and does not expose dedicated back/forward methods.
     */
    await this.sandbox.leftClick(x, y);
  }

  async doubleClick(
    x: number,
    y: number,
  ): Promise<void> {
    await this.sandbox.doubleClick(x, y);
  }

  async scroll(
    x: number,
    y: number,
    _scrollX: number,
    scrollY: number,
  ): Promise<void> {
    await this.sandbox.moveMouse(x, y);

    await this.sandbox.scroll(
      scrollY > 0 ? "down" : "up",
      Math.max(
        1,
        Math.abs(scrollY),
      ),
    );
  }

  async type(text: string): Promise<void> {
    await this.sandbox.write(text, {
      chunkSize: 50,
      delayInMs: 20,
    });
  }

  async wait(): Promise<void> {
    await this.sandbox.wait(1000);
  }

  async move(
    x: number,
    y: number,
  ): Promise<void> {
    await this.sandbox.moveMouse(x, y);
  }

  async keypress(
    keys: string[],
  ): Promise<void> {
    await this.sandbox.press(
      keys.map(normalizeKey),
    );
  }

  async drag(
    path: [number, number][],
  ): Promise<void> {
    if (path.length < 2) {
      return;
    }

    await this.sandbox.moveMouse(
      path[0][0],
      path[0][1],
    );

    await this.sandbox.mousePress("left");

    for (const [x, y] of path.slice(1)) {
      await this.sandbox.moveMouse(x, y);
    }

    await this.sandbox.mouseRelease(
      "left",
    );
  }
}
