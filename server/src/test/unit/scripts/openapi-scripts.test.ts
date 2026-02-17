import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { runTsxInlineScript } from "../../helpers/subprocess-test.helpers.js";

const execFileAsync = promisify(execFile);

test("check-openapi-drift script exits cleanly on current route/docs snapshot", async () => {
    await execFileAsync(
        process.execPath,
        ["--import", "tsx", "src/scripts/check-openapi-drift.ts"],
        {
            cwd: process.cwd(),
            env: { ...process.env },
            maxBuffer: 10 * 1024 * 1024,
        }
    );
});

test("sync-openapi-endpoints script writes placeholder operation for missing route in temp workspace", async () => {
    const tempServerRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mcmk-openapi-sync-"));
    const routesDir = path.join(tempServerRoot, "src", "routes");
    const docsDir = path.join(tempServerRoot, "src", "docs");

    try {
        await fs.mkdir(routesDir, { recursive: true });
        await fs.mkdir(docsDir, { recursive: true });

        await fs.writeFile(
            path.join(routesDir, "probe.routes.ts"),
            [
                'import { Router } from "express";',
                "const router = Router();",
                'router.get("/probe", (_req, res) => res.send("ok"));',
                "export default router;",
                "",
            ].join("\n"),
            "utf8"
        );

        const syncScriptUrl = pathToFileURL(path.join(process.cwd(), "src/scripts/sync-openapi-endpoints.ts")).href;

        await runTsxInlineScript({
            script: `
process.chdir(process.env.TEST_SERVER_ROOT);
await import(process.env.SYNC_SCRIPT_URL);
`,
            env: {
                TEST_SERVER_ROOT: tempServerRoot,
                SYNC_SCRIPT_URL: syncScriptUrl,
            },
        });

        const generated = await fs.readFile(path.join(docsDir, "openapi.ts"), "utf8");
        assert.match(generated, /"\/probe"/);
        assert.match(generated, /"TODO: GET \/probe"/);
        assert.match(generated, /"Auto"/);
    } finally {
        await fs.rm(tempServerRoot, { recursive: true, force: true });
    }
});
