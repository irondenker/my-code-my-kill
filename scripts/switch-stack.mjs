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
const composeFiles = ["docker-compose.yml", "docker-compose.prod.yml"];
const hostPortsByMode = {
    dev: [30000, 8080, 54321],
    prod: [3000, 80, 5432],
};

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

function getContainersPublishingPort(port) {
    const result = spawnSync(
        "docker",
        ["ps", "--filter", `publish=${port}`, "--format", "{{.Names}}"],
        { cwd: repoRoot, encoding: "utf-8" },
    );

    if (result.error || (result.status ?? 1) !== 0) {
        return [];
    }

    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

for (const composeFile of composeFiles) {
    console.log(`[switch-stack] Stopping stack: ${composeFile}`);
    runDockerCompose(["-f", composeFile, "down", "--remove-orphans"]);
}

for (const port of hostPortsByMode[modeArg]) {
    const conflictingContainers = getContainersPublishingPort(port);
    if (conflictingContainers.length > 0) {
        console.error(
            `[switch-stack] Port ${port} is still occupied by: ${conflictingContainers.join(", ")}`,
        );
        console.error(
            "[switch-stack] Stop them first, then retry. Example: docker rm -f <container_name>",
        );
        process.exit(1);
    }
}

console.log(`[switch-stack] Starting target stack: ${targetComposeFile}`);
const upArgs = ["-f", targetComposeFile, "up", "-d"];
if (build) {
    upArgs.push("--build");
}
runDockerCompose(upArgs);

console.log("[switch-stack] Active services");
runDockerCompose(["-f", targetComposeFile, "ps"]);
