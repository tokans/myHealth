/**
 * Open an external URL in the user's default browser.
 *
 * Repointed onto the shared, scheme-guarded `sharedcorelib/env` implementation (subsystem:
 * env). Kept as a 1-line re-export shim so the many `@/lib/openExternal` importers
 * (AppShell, ProfileDrawer, donate, catalog, ReportIssueDialog) are untouched.
 */
export { openExternal } from "sharedcorelib/env";
