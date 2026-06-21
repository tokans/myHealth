/**
 * Suite-standard "Report an issue" → prefilled GitHub new-issue URL.
 *
 * Repointed onto `sharedcorelib/suite` → `createIssueReporter`; the byte-identical local
 * builder (article/collectContext/buildIssueUrl + the issue-type vocabulary) was removed.
 * This file keeps only myHealth's config (the receiving repo + the "Starter" default tier
 * label) and re-exports the reporter's surface under the existing names so the importers
 * (`ReportIssueDialog`, the test) are unchanged.
 */
import { createIssueReporter, type IssueType, type IssueDraft } from "sharedcorelib/suite";

/** Repo that receives issue reports. */
export const ISSUE_REPO = "tokans/myHealth";

const reporter = createIssueReporter({ repo: ISSUE_REPO, defaultTierLabel: "Starter" });

export const ISSUE_TYPES = reporter.ISSUE_TYPES;
export const collectContext = reporter.collectContext;
export const buildIssueUrl = reporter.buildIssueUrl;

export type { IssueType, IssueDraft };
