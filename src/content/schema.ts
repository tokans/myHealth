/**
 * OTA content payload schemas — re-exported from the shared content framework
 * (`sharedcorelib/content`). Kept as a local module so call sites can import from
 * `@/content/schema`; the schemas themselves are app-agnostic and live in core.
 */
export { contentBundleSchema, contentTypeMetaSchema } from "sharedcorelib/content";
