// Cross-platform launcher for the dev/QA tier override (see src/lib/tierOverride.ts).
//
//   node scripts/start-tier.mjs <tier> [dev|tauri]
//
// Sets VITE_TIER and starts the app at that tier. Defaults to the full Tauri app
// ("tauri"); pass "dev" for the browser-only Vite preview. Used by the npm
// `tier:*` / `dev:tier:*` shortcuts. Inline `VITE_TIER=x ...` is not portable to
// Windows npm scripts, so we spawn here instead.
import { spawn } from "node:child_process";

const TIERS = ["starter", "tracker", "caretaker", "champion", "supporter", "pro"];
const tier = (process.argv[2] || "").toLowerCase();
const mode = (process.argv[3] || "tauri").toLowerCase();

if (!TIERS.includes(tier)) {
  console.error(`Unknown tier "${tier}". Use one of: ${TIERS.join(", ")}`);
  process.exit(1);
}

const command = mode === "dev" ? ["npm", "run", "dev"] : ["npm", "run", "tauri:dev"];
console.log(`Starting at tier "${tier}" via "${command.join(" ")}" (VITE_TIER=${tier})`);

const child = spawn(command[0], command.slice(1), {
  stdio: "inherit",
  shell: true, // resolve npm/npm.cmd across platforms
  env: { ...process.env, VITE_TIER: tier },
});
child.on("exit", (code) => process.exit(code ?? 0));
