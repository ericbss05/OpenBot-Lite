import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3101),
  LITE_API_KEY: z.string().min(8),
  ALLOW_PRIVATE_HOSTS: z
    .enum(["true", "false", "1", "0"])
    .default("true")
    .transform((v) => v === "true" || v === "1"),
  ACTION_POLICY_MODE: z.enum(["enforce", "dry-run"]).default("enforce"),
});

export type LiteConfig = z.infer<typeof envSchema> & {
  singleUser: true;
};

export function loadConfig(): LiteConfig {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Configuration invalide: ${msg}. Copiez .env.example vers .env`,
    );
  }

  return {
    ...parsed.data,
    singleUser: true,
  };
}
