import { describe, it, expect } from "vitest";
import { buildIssueUrl, ISSUE_REPO, ISSUE_TYPES, type IssueDraft } from "./reportIssue";

const base: IssueDraft = {
  type: "bug",
  title: "Water count resets",
  description: "the water counter resets at midnight unexpectedly",
  includeContext: false,
  tierLabel: "Tracker",
};

function parse(url: string) {
  const u = new URL(url);
  return { u, params: u.searchParams };
}

describe("buildIssueUrl", () => {
  it("targets the configured repo's new-issue endpoint", () => {
    const { u } = parse(buildIssueUrl(base, ""));
    expect(u.origin + u.pathname).toBe(`https://github.com/${ISSUE_REPO}/issues/new`);
  });

  it("encodes the title and a tier-led body", () => {
    const { params } = parse(buildIssueUrl(base, ""));
    expect(params.get("title")).toBe("Water count resets");
    expect(params.get("body")).toContain("I am a Tracker user and the water counter resets");
  });

  it("uses the correct article for a vowel-initial tier", () => {
    const { params } = parse(buildIssueUrl({ ...base, tierLabel: "Explorer" }, ""));
    expect(params.get("body")).toContain("I am an Explorer user");
  });

  it("maps the issue type to its GitHub label", () => {
    expect(parse(buildIssueUrl({ ...base, type: "bug" }, "")).params.get("labels")).toBe("bug");
    expect(parse(buildIssueUrl({ ...base, type: "feature" }, "")).params.get("labels")).toBe("enhancement");
    expect(parse(buildIssueUrl({ ...base, type: "question" }, "")).params.get("labels")).toBe("question");
  });

  it("includes steps and environment context only when provided/opted-in", () => {
    const withSteps = parse(buildIssueUrl({ ...base, steps: "1. wait until midnight" }, "ctx")).params.get("body")!;
    expect(withSteps).toContain("### Steps to reproduce");
    expect(withSteps).not.toContain("### Environment"); // includeContext false

    const withCtx = parse(buildIssueUrl({ ...base, includeContext: true }, "- App version: 1.0")).params.get("body")!;
    expect(withCtx).toContain("### Environment");
    expect(withCtx).toContain("- App version: 1.0");

    const ctxButEmpty = parse(buildIssueUrl({ ...base, includeContext: true }, "")).params.get("body")!;
    expect(ctxButEmpty).not.toContain("### Environment"); // opted in but no context string
  });

  it("defaults an empty tier label to Starter", () => {
    const { params } = parse(buildIssueUrl({ ...base, tierLabel: "  " }, ""));
    expect(params.get("body")).toContain("I am a Starter user");
  });
});

describe("ISSUE_TYPES", () => {
  it("declares the three issue types with GitHub labels", () => {
    expect(ISSUE_TYPES.map((t) => t.value)).toEqual(["bug", "feature", "question"]);
    for (const t of ISSUE_TYPES) expect(t.label_gh).toBeTruthy();
  });
});
