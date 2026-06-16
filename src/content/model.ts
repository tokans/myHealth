/**
 * Content model — myHealth's binding of the shared content framework
 * (`sharedcorelib/content`). The generic mechanism (types + pure helpers) lives
 * in core; here we only pin the app-specific type parameters: the icon component
 * type (Lucide) and the earned-tier names. App code imports from `@/content/model`.
 */
import type { LucideIcon } from "lucide-react";
import type { EarnedTier } from "@/lib/featureGate";
import type {
  ContentType as CoreContentType,
  ContentTypeMeta as CoreContentTypeMeta,
} from "sharedcorelib/content";

/** A runtime content type with a Lucide icon and myHealth's earned tiers. */
export type ContentType = CoreContentType<LucideIcon, EarnedTier>;
/** Serializable type metadata (remote catalog shape) with myHealth's tiers. */
export type ContentTypeMeta = CoreContentTypeMeta<EarnedTier>;

export type { ContentStep, ContentEntry, ContentBundle, ContentLevel } from "sharedcorelib/content";
export {
  totalDurationSec,
  formatDuration,
  mergeEntries,
  bundleEntries,
  focusTags,
  stepImage,
} from "sharedcorelib/content";

// Arbitrary-depth content TREES (interim-folder property files + leaf content).
// An app gathers its `content/**` files (via `import.meta.glob`) into RawFiles and
// folds them with `buildContentTree`/`buildContentTreeFromGlob`.
export type { ContentNode, PropertyValue, RawFile } from "sharedcorelib/content";
export {
  buildContentTree,
  buildContentTreeFromGlob,
  buildNodeTree,
  parseProperty,
  parseSimpleYaml,
  nodeAt,
  nodeLabel,
  nodeOrder,
  nodeEntries,
  leaves,
  prop,
  propString,
  propData,
} from "sharedcorelib/content";
