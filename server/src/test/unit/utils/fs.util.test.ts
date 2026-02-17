import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ensureDir, safeUnlink } from "../../../utils/fs.util.js";

test("ensureDir creates nested directories recursively", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mcmk-fs-util-"));
    const nested = path.join(root, "a", "b", "c");

    try {
        await ensureDir(nested);
        const stat = await fs.stat(nested);
        assert.equal(stat.isDirectory(), true);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test("safeUnlink deletes existing file and ignores missing/null path", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mcmk-fs-unlink-"));
    const filePath = path.join(root, "temp.txt");

    try {
        await fs.writeFile(filePath, "hello", "utf8");
        await safeUnlink(filePath);
        await assert.rejects(async () => fs.stat(filePath));

        await safeUnlink(filePath);
        await safeUnlink(null);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});
