/**
 * OpenMed medical-NER capability detection — STUB (Stage C prompt 04 Phase 4).
 *
 * Phase 4 (PAID-tier OpenMed extraction via the Python sidecar) is NOT built: the sidecar
 * itself does not exist yet (it ships with a paid app — myLifeAssistant/myWorkAssistant —
 * per `02-tokans-backend` Phase 8). This module is ONLY a capability-detection stub so the
 * rest of the app can ask "is smarter extraction available?" without any behavior change.
 *
 * HARD CONSTRAINTS honored here:
 *   - The FREE deterministic/OCR extraction path (`src/import/`) is UNCHANGED. This stub is
 *     additive and is never on the free path.
 *   - OpenMed would run ON-DEVICE via the sidecar; it NEVER egresses health data. This stub
 *     performs NO network call and carries no health bytes.
 *   - Double-gate: smarter extraction only lights up with BOTH the sidecar present AND a
 *     paid entitlement. Until the sidecar exists, detection always returns "absent".
 */

/** Result of probing for the OpenMed sidecar. */
export interface OpenMedCapability {
  /** True only when the local Python sidecar exposing OpenMed is detected. */
  sidecarPresent: boolean;
  /** True when the user has a paid entitlement that includes OpenMed. */
  entitled: boolean;
  /** Smarter extraction is usable only when BOTH are true (double-gate). */
  available: boolean;
}

/** A pluggable probe; the live one will handshake the sidecar. Injected for testability. */
export interface OpenMedProbe {
  /** Detect the local sidecar (capability handshake). NO network, NO health data. */
  detectSidecar(): Promise<boolean> | boolean;
  /** Resolve paid entitlement (patron/partner/paid). */
  hasEntitlement(): Promise<boolean> | boolean;
}

/**
 * The default probe: the sidecar is NOT built, so detection always reports absent. This is
 * the safe default that keeps the free path the ONLY path. Replace with a real probe when
 * `02-tokans-backend` Phase 8 lands the sidecar handshake.
 */
export const STUB_PROBE: OpenMedProbe = {
  detectSidecar: () => false,
  hasEntitlement: () => false,
};

/** Probe OpenMed capability. Pure: no side effects beyond the injected probe. */
export async function detectOpenMed(probe: OpenMedProbe = STUB_PROBE): Promise<OpenMedCapability> {
  const sidecarPresent = await probe.detectSidecar();
  const entitled = await probe.hasEntitlement();
  return { sidecarPresent, entitled, available: sidecarPresent && entitled };
}

/**
 * Whether to surface the "unlock smarter medical extraction with myLifeAssistant" nudge:
 * only when smarter extraction is NOT already available (so we never nag an entitled user).
 * The actual extraction call site stays on the free path until `available` is true.
 */
export function shouldNudgeOpenMed(cap: OpenMedCapability): boolean {
  return !cap.available;
}
