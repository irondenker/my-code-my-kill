import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const TEST_ROOT = path.join(process.cwd(), "src", "test");
const mode = process.argv[2] ?? "unit";

if (mode !== "unit" && mode !== "db") {
    console.error(`[TEST] Unknown mode: ${mode}. Expected "unit" or "db".`);
    process.exit(1);
}

function collectFiles(dirPath) {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath));
            continue;
        }
        files.push(fullPath);
    }

    return files;
}

const allTestFiles = collectFiles(TEST_ROOT).filter((filePath) => filePath.endsWith(".test.ts"));
const selected = allTestFiles.filter((filePath) => {
    const isDb = filePath.endsWith(".db.test.ts");
    return mode === "db" ? isDb : !isDb;
});

selected.sort((a, b) => a.localeCompare(b));

if (selected.length === 0) {
    console.error(`[TEST] No test files matched mode: ${mode}`);
    process.exit(1);
}

const relativeFiles = selected.map((filePath) => path.relative(process.cwd(), filePath));
const child = spawnSync(process.execPath, ["--import", "tsx", "--test", ...relativeFiles], {
    stdio: "inherit",
    env: {
        ...process.env,
        ...(mode === "db" ? { RUN_DB_TESTS: "1" } : {}),
    },
});

if (typeof child.status === "number") {
    process.exit(child.status);
}

if (child.error) {
    console.error(`[TEST] Failed to execute node test runner: ${child.error.message}`);
}
process.exit(1);
