import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import {
    createErrorCommonStaticMiddleware,
    createPublicStaticMiddleware,
} from "../../../middlewares/static.middleware.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mcmk-static-mw-"));
    try {
        await run(dir);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
}

async function withExpressServer(app: express.Express, run: (baseUrl: string) => Promise<void>): Promise<void> {
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
        server.close();
        throw new Error("Failed to bind test server");
    }
    const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

    try {
        await run(baseUrl);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
}

test("createPublicStaticMiddleware sets nosniff for public assets and attachment for uploaded files", async () => {
    await withTempDir(async (rootDir) => {
        const publicDir = path.join(rootDir, "public");
        const cssPath = path.join(publicDir, "assets", "style.css");
        const uploadFilePath = path.join(publicDir, "uploads", "posts", "files", "manual.txt");
        const uploadImagePath = path.join(publicDir, "uploads", "posts", "images", "cover.txt");

        await fs.mkdir(path.dirname(cssPath), { recursive: true });
        await fs.mkdir(path.dirname(uploadFilePath), { recursive: true });
        await fs.mkdir(path.dirname(uploadImagePath), { recursive: true });
        await fs.writeFile(cssPath, "body{}", "utf8");
        await fs.writeFile(uploadFilePath, "download-me", "utf8");
        await fs.writeFile(uploadImagePath, "inline-ok", "utf8");

        const app = express();
        app.use(createPublicStaticMiddleware({ publicDir }));

        await withExpressServer(app, async (baseUrl) => {
            const cssResponse = await fetch(`${baseUrl}/assets/style.css`);
            assert.equal(cssResponse.status, 200);
            assert.equal(cssResponse.headers.get("x-content-type-options"), "nosniff");
            assert.equal(cssResponse.headers.get("content-disposition"), null);

            const fileResponse = await fetch(`${baseUrl}/uploads/posts/files/manual.txt`);
            assert.equal(fileResponse.status, 200);
            assert.equal(fileResponse.headers.get("x-content-type-options"), "nosniff");
            const fileDisposition = fileResponse.headers.get("content-disposition") ?? "";
            assert.match(fileDisposition, /attachment;/);
            assert.match(fileDisposition, /filename="manual\.txt"/);

            const imageResponse = await fetch(`${baseUrl}/uploads/posts/images/cover.txt`);
            assert.equal(imageResponse.status, 200);
            assert.equal(imageResponse.headers.get("x-content-type-options"), "nosniff");
            assert.equal(imageResponse.headers.get("content-disposition"), null);
        });
    });
});

test("createErrorCommonStaticMiddleware serves files under common path with nosniff", async () => {
    await withTempDir(async (rootDir) => {
        const errorRoot = path.join(rootDir, "errors");
        const commonCssPath = path.join(errorRoot, "common", "error.css");
        await fs.mkdir(path.dirname(commonCssPath), { recursive: true });
        await fs.writeFile(commonCssPath, ".error{color:red;}", "utf8");

        const app = express();
        app.use(createErrorCommonStaticMiddleware({ errorStaticRoot: errorRoot }));

        await withExpressServer(app, async (baseUrl) => {
            const response = await fetch(`${baseUrl}/error.css`);
            assert.equal(response.status, 200);
            assert.equal(response.headers.get("x-content-type-options"), "nosniff");
            const body = await response.text();
            assert.match(body, /color:red/);
        });
    });
});
