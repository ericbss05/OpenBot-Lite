import type {
  Tool,
  ToolExecutionContext,
} from "../tools";

import {
  COMPUTER_GUIDANCE_LINES
} from "../../prompt/system";

import { E2BDesktopComputer } from "../../computer/desktop-computer";
import type { ComputerSandboxStore } from "../../computer/sandbox-store";

type ComputerAction =
  | "screenshot"
  | "click"
  | "double_click"
  | "scroll"
  | "type"
  | "wait"
  | "move"
  | "keypress"
  | "drag"
  | "request_human_control";

type ComputerArguments = {
  action: ComputerAction;

  x?: number;
  y?: number;

  button?:
    | "left"
    | "right"
    | "wheel"
    | "back"
    | "forward";

  scrollX?: number;
  scrollY?: number;

  text?: string;

  keys?: string[];

  path?: [number, number][];

  reason?: string;
  message?: string;
};

function requireCoordinates(
  args: ComputerArguments,
  action: string,
): asserts args is ComputerArguments & {
  x: number;
  y: number;
} {
  if (
    args.x === undefined ||
    args.y === undefined
  ) {
    throw new Error(
      `computer ${action} requires x and y`,
    );
  }
}

function requireScroll(
  args: ComputerArguments,
): asserts args is ComputerArguments & {
  x: number;
  y: number;
  scrollY: number;
} {
  if (
    args.x === undefined ||
    args.y === undefined ||
    args.scrollY === undefined
  ) {
    throw new Error(
      "computer scroll requires x, y and scrollY",
    );
  }
}

function requireText(
  args: ComputerArguments,
): asserts args is ComputerArguments & {
  text: string;
} {
  if (args.text === undefined) {
    throw new Error(
      "computer type requires text",
    );
  }
}

function requireKeys(
  args: ComputerArguments,
): asserts args is ComputerArguments & {
  keys: string[];
} {
  if (
    !args.keys ||
    args.keys.length === 0
  ) {
    throw new Error(
      "computer keypress requires keys",
    );
  }
}

function requirePath(
  args: ComputerArguments,
): asserts args is ComputerArguments & {
  path: [number, number][];
} {
  if (
    !args.path ||
    args.path.length === 0
  ) {
    throw new Error(
      "computer drag requires path",
    );
  }
}

export function createComputerTool(
  sandboxStore: ComputerSandboxStore,
): Tool {
  return {
    definition: {
      id: "computer",

      description: [
        ...COMPUTER_GUIDANCE_LINES,

        "",
        "The computer tool actions available in this deployment are:",
        "- screenshot: observe the current screen.",
        "- click: click at screen coordinates.",
        "- double_click: double-click at screen coordinates.",
        "- scroll: scroll at screen coordinates.",
        "- type: type text into the currently focused element.",
        "- wait: wait for the page or application to change.",
        "- move: move the mouse.",
        "- keypress: press keyboard keys.",
        "- drag: drag the mouse along a coordinate path.",
        "- request_human_control: give control of the browser to the person.",
      ].join("\n"),

      requiresApproval: false,

      inputSchema: {
        type: "object",

        properties: {
          action: {
            type: "string",
            description:
              "The computer operation to perform.",
            enum: [
              "screenshot",
              "click",
              "double_click",
              "scroll",
              "type",
              "wait",
              "move",
              "keypress",
              "drag",
              "request_human_control",
            ],
          },

          x: {
            type: "number",
          },

          y: {
            type: "number",
          },

          button: {
            type: "string",
            enum: [
              "left",
              "right",
              "wheel",
              "back",
              "forward",
            ],
          },

          scrollX: {
            type: "number",
          },

          scrollY: {
            type: "number",
          },

          text: {
            type: "string",
          },

          keys: {
            type: "array",
            items: {
              type: "string",
            },
          },

          path: {
            type: "array",
            items: {
              type: "array",
              items: {
                type: "number",
              },
              minItems: 2,
              maxItems: 2,
            },
          },

          reason: {
            type: "string",
          },

          message: {
            type: "string",
          },
        },

        required: ["action"],

        additionalProperties: false,
      },
    },

    execute: async (
      arguments_,
      context?: ToolExecutionContext,
    ) => {
      if (!context) {
        throw new Error(
          "Computer tool requires an execution context.",
        );
      }

      const args =
        arguments_ as ComputerArguments;

      /**
       * Human takeover is a control-flow signal.
       * It does not require creating or connecting
       * to a computer sandbox.
       */
      if (
        args.action ===
        "request_human_control"
      ) {
        const reason =
          args.reason?.trim() ||
          "Human intervention is required.";

        const message =
          args.message?.trim() ||
          reason;

        return {
          type: "human_control_requested" as const,
          reason,
          message,
        };
      }

      const sandbox =
        await sandboxStore.getOrCreate(
          context.agentId,
        );

      const computer =
        new E2BDesktopComputer(sandbox);

      switch (args.action) {
        case "screenshot": {
          const screenshot =
            await computer.screenshot();

          return {
            type: "computer_screenshot" as const,
            action: "screenshot" as const,
            screenshot,
            dimensions:
              computer.dimensions,
            environment:
              computer.environment,
          };
        }

        case "click": {
          requireCoordinates(
            args,
            "click",
          );

          const button =
            args.button ?? "left";

          await computer.click(
            args.x,
            args.y,
            button,
          );

          return {
            type: "computer_action" as const,
            action: "click" as const,
            x: args.x,
            y: args.y,
            button,
          };
        }

        case "double_click": {
          requireCoordinates(
            args,
            "double_click",
          );

          await computer.doubleClick(
            args.x,
            args.y,
          );

          return {
            type: "computer_action" as const,
            action: "double_click" as const,
            x: args.x,
            y: args.y,
          };
        }

        case "scroll": {
          requireScroll(args);

          const scrollX =
            args.scrollX ?? 0;

          await computer.scroll(
            args.x,
            args.y,
            scrollX,
            args.scrollY,
          );

          return {
            type: "computer_action" as const,
            action: "scroll" as const,
            x: args.x,
            y: args.y,
            scrollX,
            scrollY: args.scrollY,
          };
        }

        case "type": {
          requireText(args);

          await computer.type(
            args.text,
          );

          return {
            type: "computer_action" as const,
            action: "type" as const,
            text: args.text,
          };
        }

        case "wait": {
          await computer.wait();

          return {
            type: "computer_action" as const,
            action: "wait" as const,
          };
        }

        case "move": {
          requireCoordinates(
            args,
            "move",
          );

          await computer.move(
            args.x,
            args.y,
          );

          return {
            type: "computer_action" as const,
            action: "move" as const,
            x: args.x,
            y: args.y,
          };
        }

        case "keypress": {
          requireKeys(args);

          await computer.keypress(
            args.keys,
          );

          return {
            type: "computer_action" as const,
            action: "keypress" as const,
            keys: args.keys,
          };
        }

        case "drag": {
          requirePath(args);

          await computer.drag(
            args.path,
          );

          return {
            type: "computer_action" as const,
            action: "drag" as const,
            path: args.path,
          };
        }

        default: {
          const action: never =
            args.action;

          throw new Error(
            `Unsupported computer action: ${String(action)}`,
          );
        }
      }
    },
  };
}