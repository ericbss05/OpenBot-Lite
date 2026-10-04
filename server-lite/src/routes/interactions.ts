import { Hono } from "hono";

export function createInteractionRoutes(deps: {
resumeUserInteraction: (
runId: string,
answer: string,
) => Promise<unknown>;
}) {
const app = new Hono();

app.post(
"/:runId",
async (c) => {
const runId =
c.req.param("runId");

  const body =
    await c.req.json<{
      answer?: unknown;
    }>();

  if (
    typeof body.answer !==
    "string"
  ) {
    return c.json(
      {
        error:
          "answer must be a string",
      },
      400,
    );
  }

  const answer =
    body.answer.trim();

  if (!answer) {
    return c.json(
      {
        error:
          "answer is required",
      },
      400,
    );
  }

  try {
    const result =
      await deps.resumeUserInteraction(
        runId,
        answer,
      );

    return c.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error(
      "[INTERACTIONS] Failed to resume user interaction",
      {
        runId,
        error,
      },
    );

    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to resume user interaction",
      },
      400,
    );
  }
},


);

return app;
}
