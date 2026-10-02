import { calculatorTool } from "../tools/internal/calculator";
import {
  ToolExecutor,
  ToolRegistry,
} from "../tools/tools";

const registry = new ToolRegistry();

registry.register(calculatorTool);

const executor = new ToolExecutor(registry);

const result = await executor.execute({
  id: "test-calculator-1",
  toolId: "calculator",
  arguments: {
    a: 25,
    b: 37,
    operation: "multiply",
  },
});

console.log(result);