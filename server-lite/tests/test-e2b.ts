import { Sandbox } from "e2b";

const sandbox = await Sandbox.create({
  apiKey: process.env.E2B_API_KEY,
});

console.log("E2B sandbox créée :", sandbox.sandboxId);

await sandbox.kill();

console.log("E2B sandbox supprimée");