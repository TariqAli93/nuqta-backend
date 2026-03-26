import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

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
  CORS_ORIGIN: z.string().default("*"),
});

export const env = envSchema.parse(process.env);
