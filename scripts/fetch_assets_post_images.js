#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const REPO_ROOT = path.resolve(__dirname, "..");
const SEED_ASSET_ROOT = path.join(REPO_ROOT, "seed-assets");
const RAW_DIR = path.join(SEED_ASSET_ROOT, "raw", "post-images");
const MANIFEST_DIR = path.join(SEED_ASSET_ROOT, "manifest");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "post-images.json");

const DEFAULTS = {
    count: 1200,
    concurrency: 8,
    timeoutMs: 15000,
    retries: 3,
    width: 1280,
    height: 960,
    seed: "mcmk-post-images-v1",
};

function getArgValue(name, fallback) {
    const prefix = `--${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    if (!match) {
        return fallback;
    }
    return match.slice(prefix.length);
}

function toInt(value, fallback) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function buildConfig() {
    return {
        count: toInt(getArgValue("count", process.env.ASSETS_POST_IMAGE_COUNT ?? DEFAULTS.count), DEFAULTS.count),
        concurrency: Math.min(
            10,
            Math.max(1, toInt(getArgValue("concurrency", process.env.ASSETS_POST_IMAGE_CONCURRENCY ?? DEFAULTS.concurrency), DEFAULTS.concurrency))
        ),
        timeoutMs: Math.max(1000, toInt(getArgValue("timeout", process.env.ASSETS_POST_IMAGE_TIMEOUT_MS ?? DEFAULTS.timeoutMs), DEFAULTS.timeoutMs)),
        retries: Math.max(1, toInt(getArgValue("retries", process.env.ASSETS_POST_IMAGE_RETRIES ?? DEFAULTS.retries), DEFAULTS.retries)),
        width: Math.max(128, toInt(getArgValue("width", process.env.ASSETS_POST_IMAGE_WIDTH ?? DEFAULTS.width), DEFAULTS.width)),
        height: Math.max(128, toInt(getArgValue("height", process.env.ASSETS_POST_IMAGE_HEIGHT ?? DEFAULTS.height), DEFAULTS.height)),
        seed: String(getArgValue("seed", process.env.ASSETS_POST_IMAGE_SEED ?? DEFAULTS.seed)),
    };
}

function fileNameFor(index, config) {
    return `picsum_seed-${config.seed}_${config.width}x${config.height}_${String(index).padStart(4, "0")}.jpg`;
}

function sourceUrlFor(index, config) {
    const token = encodeURIComponent(`${config.seed}-${index}`);
    return `https://picsum.photos/seed/${token}/${config.width}/${config.height}.jpg`;
}

async function ensureDirs() {
    await fs.mkdir(RAW_DIR, { recursive: true });
    await fs.mkdir(MANIFEST_DIR, { recursive: true });
}

async function sha256File(filePath) {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function fetchBufferWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "my-code-my-kill-seed-assets/1.0",
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } finally {
        clearTimeout(timeoutHandle);
    }
}

async function downloadWithRetry(url, outputPath, timeoutMs, retries) {
    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            const bytes = await fetchBufferWithTimeout(url, timeoutMs);
            await fs.writeFile(outputPath, bytes);
            return;
        } catch (err) {
            lastError = err;
            if (attempt < retries) {
                const delayMs = Math.min(1000 * (2 ** (attempt - 1)), 4000);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }
    throw lastError instanceof Error ? lastError : new Error("download failed");
}

async function processOne(index, config) {
    const filename = fileNameFor(index, config);
    const outputPath = path.join(RAW_DIR, filename);
    const sourceUrl = sourceUrlFor(index, config);

    let skipped = false;
    try {
        const existing = await fs.stat(outputPath);
        if (existing.size > 0) {
            skipped = true;
        }
    } catch {
        skipped = false;
    }

    if (!skipped) {
        await downloadWithRetry(sourceUrl, outputPath, config.timeoutMs, config.retries);
    }

    const stats = await fs.stat(outputPath);
    const sha256 = await sha256File(outputPath);

    return {
        index,
        sourceUrl,
        relativePath: path.posix.join("raw", "post-images", filename),
        extension: ".jpg",
        size: stats.size,
        sha256,
        width: config.width,
        height: config.height,
        skipped,
    };
}

async function runWorkers(config) {
    const results = new Array(config.count);
    let cursor = 1;

    async function worker() {
        while (true) {
            const next = cursor;
            cursor += 1;
            if (next > config.count) {
                return;
            }
            const entry = await processOne(next, config);
            results[next - 1] = entry;
            if (next % 100 === 0 || next === config.count) {
                process.stdout.write(`processed ${next}/${config.count}\n`);
            }
        }
    }

    await Promise.all(Array.from({ length: config.concurrency }, () => worker()));
    return results;
}

async function writeManifest(config, entries) {
    const skippedCount = entries.filter((entry) => entry.skipped).length;
    const payload = {
        generatedAt: new Date().toISOString(),
        source: "Lorem Picsum",
        config,
        summary: {
            total: entries.length,
            skipped: skippedCount,
            downloaded: entries.length - skippedCount,
        },
        entries,
    };
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function main() {
    const config = buildConfig();
    await ensureDirs();
    const entries = await runWorkers(config);
    await writeManifest(config, entries);

    const skipped = entries.filter((entry) => entry.skipped).length;
    process.stdout.write(`done: total=${entries.length}, downloaded=${entries.length - skipped}, skipped=${skipped}\n`);
    process.stdout.write(`manifest: ${MANIFEST_PATH}\n`);
}

main().catch((err) => {
    console.error("fetch_assets_post_images failed:", err);
    process.exitCode = 1;
});
