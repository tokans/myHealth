/**
 * Inline SVG line-art for the baked yoga poses — the "pics" each step shows.
 * Small, dependency-free vector strings (no binary assets, no network) so the
 * sample sequences render instantly offline. Downloaded bundles instead carry
 * their own `image` as a `data:`/https URL.
 *
 * Pure data + helpers. Each figure draws inside a 120×100 viewBox standing on a
 * mat baseline at y=92 — clear enough to read the shape, not anatomical.
 */
export type PoseArt =
  | "mountain"
  | "forward-fold"
  | "tree"
  | "cobra"
  | "child"
  | "downward-dog"
  | "cat"
  | "cow"
  | "warrior"
  | "corpse"
  | "seated-twist"
  | "bridge";

const STROKE = `fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const HEAD = (cx: number, cy: number) => `<circle cx="${cx}" cy="${cy}" r="7" ${STROKE} />`;
const MAT = `<line x1="6" y1="92" x2="114" y2="92" stroke="currentColor" stroke-width="2" stroke-opacity="0.35" />`;

const FIGURES: Record<PoseArt, string> = {
  mountain: `${HEAD(60, 24)}<path d="M60 31 V62 M60 38 L48 50 M60 38 L72 50 M60 62 L52 92 M60 62 L68 92" ${STROKE} />`,
  "forward-fold": `${HEAD(60, 70)}<path d="M60 30 L60 50 M60 30 L70 22 M60 30 L50 22 M60 50 Q58 64 56 76 M60 50 L60 92" ${STROKE} />`,
  tree: `${HEAD(60, 22)}<path d="M60 29 V58 M60 36 L46 30 M60 36 L74 30 M60 58 L60 92 M60 58 L46 70 L60 80" ${STROKE} />`,
  cobra: `${HEAD(30, 56)}<path d="M30 63 Q44 60 56 70 Q74 84 104 84 M44 66 L34 80 M58 71 L52 84" ${STROKE} />`,
  child: `${HEAD(34, 70)}<path d="M34 77 Q56 82 86 82 L100 82 M86 82 Q80 66 74 60" ${STROKE} />`,
  "downward-dog": `${HEAD(34, 60)}<path d="M34 60 L78 34 L104 84 M78 34 L40 84" ${STROKE} />`,
  cat: `${HEAD(30, 50)}<path d="M30 56 Q60 38 96 56 M40 56 L40 84 M86 56 L86 84" ${STROKE} />`,
  cow: `${HEAD(30, 46)}<path d="M30 52 Q60 70 96 52 M40 60 L40 84 M86 60 L86 84" ${STROKE} />`,
  warrior: `${HEAD(58, 22)}<path d="M58 29 V52 M58 36 L40 36 M58 36 L78 32 M58 52 L40 92 M58 52 L84 92" ${STROKE} />`,
  corpse: `${HEAD(20, 80)}<path d="M27 80 L96 80 M96 80 L108 74 M96 80 L108 86" ${STROKE} />`,
  "seated-twist": `${HEAD(56, 26)}<path d="M56 33 V60 M56 40 L74 48 M56 40 L40 34 M56 60 L40 80 L70 80 M56 60 L78 70" ${STROKE} />`,
  bridge: `${HEAD(26, 64)}<path d="M26 70 Q60 44 94 70 M40 62 L40 84 M80 62 L80 84" ${STROKE} />`,
};

/** Standalone SVG document string for a pose (currentColor inherits text color). */
export function poseSvg(art: PoseArt): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" role="img">${MAT}${FIGURES[art]}</svg>`;
}

/** A `data:` URI for the pose SVG, usable directly as an `<img src>`. */
export function poseDataUri(art: PoseArt): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(poseSvg(art))}`;
}

export const POSE_ART_IDS: PoseArt[] = Object.keys(FIGURES) as PoseArt[];
