import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const rawArgs = process.argv.slice(2);
const modeArg = rawArgs.find((arg) => arg === "dev" || arg === "prod");
const build = rawArgs.includes("--build");

if (!modeArg) {
    console.error("[switch-stack] Usage: node scripts/switch-stack.mjs <dev|prod> [--build]");
    process.exit(1);
}

const targetComposeFile = modeArg === "dev" ? "docker-compose.yml" : "docker-compose.prod.yml";
const otherComposeFile = modeArg === "dev" ? "docker-compose.prod.yml" : "docker-compose.yml";

function runDockerCompose(args) {
    const result = spawnSync("docker", ["compose", ...args], {
        cwd: repoRoot,
        stdio: "inherit",
    });

    if (result.error) {
        console.error(`[switch-stack] Failed to execute docker compose: ${result.error.message}`);
        process.exit(1);
    }

    if ((result.status ?? 1) !== 0) {
        process.exit(result.status ?? 1);
    }
}

console.log(`[switch-stack] Stopping opposite stack: ${otherComposeFile}`);
runDockerCompose(["-f", otherComposeFile, "down", "--remove-orphans"]);

console.log(`[switch-stack] Starting target stack: ${targetComposeFile}`);
const upArgs = ["-f", targetComposeFile, "up", "-d"];
if (build) {
    upArgs.push("--build");
}
runDockerCompose(upArgs);

console.log("[switch-stack] Active services");
runDockerCompose(["-f", targetComposeFile, "ps"]);
