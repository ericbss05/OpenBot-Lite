import { createLLMProvider } from "../llm/factory";

const provider = createLLMProvider("anthropic");

console.log("Provider créé :", provider.constructor.name);
console.log("LLMProvider OK");