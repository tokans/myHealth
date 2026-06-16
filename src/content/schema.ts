/**
 * Zod schemas for content delivered over the air — validated AFTER the masters
 * engine has verified the Ed25519 signature and AES-GCM-decrypted the payload.
 *
 *  - `contentBundleSchema`  — one downloadable bundle of entries for a type.
 *  - `contentTypeMetaSchema`— one type registration from the remote catalog
 *                             (lets a brand-new tab appear without an app update).
 */
import { z } from "zod";

const stepSchema = z.object({
  title: z.string().min(1).max(120),
  instruction: z.string().min(1).max(2000),
  durationSec: z.number().int().positive().max(36000).optional(),
  // Only data: URIs or https images — never javascript:/http: — receive-only + safe.
  image: z
    .string()
    .max(2_000_000)
    .regex(/^(data:image\/|https:\/\/)/)
    .optional(),
});

const entrySchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  focus: z.string().max(80).optional(),
  summary: z.string().min(1).max(600),
  steps: z.array(stepSchema).min(1).max(80),
});

export const contentBundleSchema = z.object({
  bundleId: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().max(600).optional(),
  version: z.number().int().nonnegative(),
  entries: z.array(entrySchema).min(1).max(300),
});

export const contentTypeMetaSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(40),
  iconName: z.string().min(1).max(40),
  tier: z.enum(["tracker", "caretaker", "champion"]),
  releaseTag: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  entryNoun: z.string().max(24).optional(),
  order: z.number().int().min(0).max(999).optional(),
});

export type ContentBundlePayload = z.infer<typeof contentBundleSchema>;
export type ContentTypeMetaPayload = z.infer<typeof contentTypeMetaSchema>;
