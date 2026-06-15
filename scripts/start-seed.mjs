// Cross-platform launcher for the dev/QA data seeder (see src/dev/seed.ts).
//
//   node scripts/start-seed.mjs [on|reset|clear] [tauri|dev] [tier]
//
// Sets VITE_SEED and starts the app so it seeds dummy data on launch. Defaults to
// VITE_SEED=on and the full Tauri app (the seeder needs SQLite — it no-ops in the
// browser-only Vite preview). Pass a tier (starter…pro) to also set VITE_TIER, so
// you can land at, say, Champion with data already present. Used by the npm
// `seed*` shortcuts. Inline `VITE_SEED=x ...` is not portable to Windows, so we
// spawn here instead.
import { spawn } from "node:child_process";

const MODES = ["on", "reset", "clear"];
const TIERS = ["starter", "tracker", "caretaker", "champion", "supporter", "pro"];

const mode = (process.argv[2] || "on").toLowerCase();
const target = (process.argv[3] || "tauri").toLowerCase();
const tier = (process.argv[4] || "").toLowerCase();

if (!MODES.includes(mode)) {
  console.error(`Unknown seed mode "${mode}". Use one of: ${MODES.join(", ")}`);
  process.exit(1);
}
if (tier && !TIERS.includes(tier)) {
  console.error(`Unknown tier "${tier}". Use one of: ${TIERS.join(", ")}`);
  process.exit(1);
}

const command = target === "dev" ? ["npm", "run", "dev"] : ["npm", "run", "tauri:dev"];
const env = { ...process.env, VITE_SEED: mode };
if (tier) env.VITE_TIER = tier;

console.log(
  `Seeding (VITE_SEED=${mode}${tier ? `, VITE_TIER=${tier}` : ""}) via "${command.join(" ")}"`,
);
if (target === "dev") {
  console.warn("Note: the browser preview has no SQLite — the seeder no-ops. Use the Tauri target.");
}

const child = spawn(command[0], command.slice(1), {
  stdio: "inherit",
  shell: true,
  env,
});
child.on("exit", (code) => process.exit(code ?? 0));
