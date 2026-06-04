/**
 * Environment detection — re-exported from the shared core so app code has a
 * stable local import (`@/lib/environment`) regardless of where the helper lives.
 */
export { isTauri, isWeb, isMobile, isDesktop } from "sharedcorelib/env";
