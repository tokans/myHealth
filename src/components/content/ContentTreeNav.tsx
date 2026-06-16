import { Fragment } from "react";
import { ChevronRight, Home } from "lucide-react";
import { nodeLabel, type ContentNode } from "@/content/model";

/**
 * Slim top navigator for a content SUBTYPE tree: a breadcrumb-like row where each
 * level is a `<select>` (the chosen node, switchable to a sibling) and the next
 * possible node is a trailing "Choose…" dropdown. Selecting at a level navigates
 * there and resets anything deeper. The leading home crumb jumps back to the root.
 */
export function ContentTreeNav({
  root,
  path,
  onNavigate,
}: {
  root: ContentNode;
  path: string[];
  onNavigate: (path: string[]) => void;
}) {
  // One entry per chosen level, plus a trailing "choose" level when the current
  // node still has children to descend into.
  const levels: { options: ContentNode[]; selectedKey: string; index: number }[] = [];
  let node = root;
  for (let i = 0; node.children.length > 0; i++) {
    const selectedKey = path[i] ?? "";
    levels.push({ options: node.children, selectedKey, index: i });
    const selected = node.children.find((c) => c.key === selectedKey);
    if (!selected) break;
    node = selected;
  }

  const go = (index: number, value: string) => {
    const next = path.slice(0, index);
    if (value) next.push(value);
    onNavigate(next);
  };

  return (
    <nav className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm">
      <button
        type="button"
        onClick={() => onNavigate([])}
        className="flex items-center gap-1 font-medium text-foreground hover:text-primary"
        title={nodeLabel(root)}
      >
        <Home className="h-3.5 w-3.5" />
        {nodeLabel(root)}
      </button>
      {levels.map((lvl) => (
        <Fragment key={lvl.index}>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <select
            value={lvl.selectedKey}
            onChange={(e) => go(lvl.index, e.target.value)}
            className="h-8 max-w-[12rem] rounded-md border border-input bg-background px-2 text-sm"
            aria-label={lvl.selectedKey ? "Switch section" : "Choose section"}
          >
            <option value="">Choose…</option>
            {lvl.options.map((o) => (
              <option key={o.key} value={o.key}>
                {nodeLabel(o)}
              </option>
            ))}
          </select>
        </Fragment>
      ))}
    </nav>
  );
}
