import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ALLOWED_LEVELS = new Set(["none", "errors", "all"]);

function normalizeValue(raw: string): string {
    return raw.trim().replace(/^['\"]|['\"]$/g, "");
}

function readEnvStyleValue(content: string): string | null {
    const match = content.match(/^\s*AUDIT_CLI_LOG_LEVEL\s*=\s*([^\n#]+)/m);
    return match?.[1] ? normalizeValue(match[1]) : null;
}

function readComposeStyleValue(content: string): string | null {
    const match = content.match(/^\s*AUDIT_CLI_LOG_LEVEL\s*:\s*([^\n#]+)/m);
    return match?.[1] ? normalizeValue(match[1]) : null;
}

async function readFileIfExists(targetPath: string): Promise<string | null> {
    try {
        return await fs.readFile(targetPath, "utf8");
    } catch {
        return null;
    }
}

test("docker compose files use an allowed AUDIT_CLI_LOG_LEVEL", async () => {
    const workspaceRoot = path.resolve(process.cwd(), "..");
    const devComposePath = path.join(workspaceRoot, "docker-compose.yml");
    const prodComposePath = path.join(workspaceRoot, "docker-compose.prod.yml");

    const [devCompose, prodCompose] = await Promise.all([
        fs.readFile(devComposePath, "utf8"),
        fs.readFile(prodComposePath, "utf8"),
    ]);

    const devValue = readComposeStyleValue(devCompose);
    const prodValue = readComposeStyleValue(prodCompose);

    assert.notEqual(devValue, null);
    assert.notEqual(prodValue, null);
    assert.equal(ALLOWED_LEVELS.has(devValue ?? ""), true);
    assert.equal(ALLOWED_LEVELS.has(prodValue ?? ""), true);
});

test("server env files use an allowed AUDIT_CLI_LOG_LEVEL", async () => {
    const serverRoot = process.cwd();
    const prodEnvPath = path.join(serverRoot, ".env.production");
    const optionalDevEnvPath = path.join(serverRoot, ".env");

    const [prodEnv, optionalDevEnv] = await Promise.all([
        fs.readFile(prodEnvPath, "utf8"),
        readFileIfExists(optionalDevEnvPath),
    ]);

    const prodValue = readEnvStyleValue(prodEnv);
    assert.notEqual(prodValue, null);
    assert.equal(ALLOWED_LEVELS.has(prodValue ?? ""), true);

    if (optionalDevEnv !== null) {
        const devValue = readEnvStyleValue(optionalDevEnv);
        assert.notEqual(devValue, null);
        assert.equal(ALLOWED_LEVELS.has(devValue ?? ""), true);
    }
});
