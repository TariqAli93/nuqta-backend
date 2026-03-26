import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

console.log("ENV CHECK", {
  cwd: process.cwd(),
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
});

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const isProd = process.env.NODE_ENV === "production";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine((v) => v.startsWith("postgres"), {
      message: 'DATABASE_URL must start with "postgres"',
    }),

  DB_NAME: z.string().min(1, "DB_NAME is required"),

  JWT_SECRET: z
    .string()
    .min(1, "JWT_SECRET is required")
    .refine((v) => !isProd || v.length >= 16, {
      message: "JWT_SECRET must be at least 16 characters in production",
    }),

  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  PORT: z.coerce.number().int().positive().default(3000),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  JWT_ALGORITHM: z.enum(["HS256", "RS256"]).default("HS256"),

  // RS256 keys — required when JWT_ALGORITHM is RS256
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
});

// In the test environment, repos are injected via testOverrides — the
// database is never actually connected, so DATABASE_URL etc. are not
// needed.  Skip the hard validation to allow tests to import app.ts
// without side-effects.
const isTest = process.env.NODE_ENV === "test";

const result = envSchema.safeParse(
  isTest
    ? {
        DATABASE_URL: process.env.DATABASE_URL ?? "postgres://test",
        DB_NAME: process.env.DB_NAME ?? "test",
        JWT_SECRET: process.env.JWT_SECRET ?? "test-secret-for-vitest-only",
        CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
        ...process.env,
      }
    : process.env,
);

if (!result.success) {
  console.error(
    "❌  Invalid environment configuration — fix the following errors before starting the server:\n",
  );

  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "root";
    console.error(`  • ${path}: ${issue.message}`);
  }

  console.error("");
  process.exit(1);
}

export const env = result.data;

// Warn (not error) if a known-insecure default is used in production.
if (env.NODE_ENV === "production" && env.JWT_SECRET === "nuqta-secret-dev") {
  console.warn(
    "⚠️   WARNING: JWT_SECRET is set to the insecure development default " +
      '("nuqta-secret-dev") in a production environment. ' +
      "Please rotate the secret immediately.",
  );
}

// Warn if RS256 is requested but keys are missing.
if (env.JWT_ALGORITHM === "RS256") {
  if (!env.JWT_PRIVATE_KEY || !env.JWT_PUBLIC_KEY) {
    console.warn(
      "⚠️   WARNING: JWT_ALGORITHM is RS256 but JWT_PRIVATE_KEY / JWT_PUBLIC_KEY " +
        "are not set — falling back to HS256.",
    );
  }
}

// Warn if CORS_ORIGIN is set to the default in production.
if (
  env.NODE_ENV === "production" &&
  env.CORS_ORIGIN === "http://localhost:5173"
) {
  console.warn(
    "⚠️   WARNING: CORS_ORIGIN is set to the default development value " +
      '("http://localhost:5173") in a production environment. ' +
      "Please update it to the correct origin.",
  );
}
