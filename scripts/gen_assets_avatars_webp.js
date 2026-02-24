#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const REPO_ROOT = path.resolve(__dirname, "..");
const SEED_ASSET_ROOT = path.join(REPO_ROOT, "seed-assets");
const RAW_DIR = path.join(SEED_ASSET_ROOT, "raw", "avatars");
const MANIFEST_DIR = path.join(SEED_ASSET_ROOT, "manifest");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "avatars.json");

const DEFAULTS = {
    count: 80,
    size: 512,
    quality: 88,
    seed: "mcmk-avatar-v1",
};

function loadSharp() {
    const sharpPath = path.join(REPO_ROOT, "server", "node_modules", "sharp");
    return require(sharpPath);
}

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
        count: Math.max(1, toInt(getArgValue("count", process.env.ASSETS_AVATAR_COUNT ?? DEFAULTS.count), DEFAULTS.count)),
        size: Math.max(128, toInt(getArgValue("size", process.env.ASSETS_AVATAR_SIZE ?? DEFAULTS.size), DEFAULTS.size)),
        quality: Math.min(100, Math.max(1, toInt(getArgValue("quality", process.env.ASSETS_AVATAR_QUALITY ?? DEFAULTS.quality), DEFAULTS.quality))),
        seed: String(getArgValue("seed", process.env.ASSETS_AVATAR_SEED ?? DEFAULTS.seed)),
    };
}

function seedToRng(seedText) {
    let state = crypto.createHash("sha256").update(seedText).digest().readUInt32BE(0) >>> 0;
    return function next() {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function pickColor(rng, saturation = 65, lightness = 55) {
    const hue = Math.floor(rng() * 360);
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function buildAvatarSvg(index, config) {
    const rng = seedToRng(`${config.seed}:${index}`);
    const grid = 6;
    const cell = config.size / grid;
    const backgroundA = pickColor(rng, 70, 22);
    const backgroundB = pickColor(rng, 68, 42);
    const primary = pickColor(rng, 80, 72);
    const secondary = pickColor(rng, 78, 64);
    const accent = pickColor(rng, 85, 58);

    const shapes = [];
    for (let y = 0; y < grid; y += 1) {
        for (let x = 0; x < Math.ceil(grid / 2); x += 1) {
            if (rng() < 0.45) {
                continue;
            }

            const mirroredX = grid - 1 - x;
            const px = x * cell;
            const py = y * cell;
            const mirrorPx = mirroredX * cell;
            const color = rng() > 0.5 ? primary : secondary;
            const radius = Math.floor(cell * (0.14 + rng() * 0.2));
            const opacity = (0.68 + rng() * 0.32).toFixed(2);

            shapes.push(`<rect x="${px}" y="${py}" width="${cell}" height="${cell}" rx="${radius}" fill="${color}" opacity="${opacity}"/>`);
            if (mirroredX !== x) {
                shapes.push(`<rect x="${mirrorPx}" y="${py}" width="${cell}" height="${cell}" rx="${radius}" fill="${color}" opacity="${opacity}"/>`);
            }
        }
    }

    const rings = [];
    const ringCount = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < ringCount; i += 1) {
        const r = Math.floor(config.size * (0.14 + i * 0.09 + rng() * 0.03));
        rings.push(
            `<circle cx="${config.size / 2}" cy="${config.size / 2}" r="${r}" fill="none" stroke="${accent}" stroke-width="${2 + Math.floor(rng() * 4)}" opacity="${(0.28 + rng() * 0.25).toFixed(2)}"/>`
        );
    }

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${config.size}" height="${config.size}" viewBox="0 0 ${config.size} ${config.size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${backgroundA}"/>
      <stop offset="100%" stop-color="${backgroundB}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  ${rings.join("\n  ")}
  ${shapes.join("\n  ")}
</svg>
`.trim();
}

function fileNameFor(index, config) {
    const seedLabel = config.seed.replace(/[^a-zA-Z0-9_-]/g, "-");
    return `avatar_gen_${seedLabel}_${String(index).padStart(4, "0")}.webp`;
}

async function sha256File(filePath) {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function ensureDirs() {
    await fs.mkdir(RAW_DIR, { recursive: true });
    await fs.mkdir(MANIFEST_DIR, { recursive: true });
}

async function processOne(index, config, sharp) {
    const filename = fileNameFor(index, config);
    const outputPath = path.join(RAW_DIR, filename);

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
        const svg = buildAvatarSvg(index, config);
        const svgBuffer = Buffer.from(svg, "utf8");
        await sharp(svgBuffer)
            .webp({ quality: config.quality })
            .toFile(outputPath);
    }

    const stats = await fs.stat(outputPath);
    const sha256 = await sha256File(outputPath);

    return {
        index,
        generator: "deterministic-identicon",
        relativePath: path.posix.join("raw", "avatars", filename),
        extension: ".webp",
        size: stats.size,
        sha256,
        skipped,
        seed: config.seed,
        sizePx: config.size,
    };
}

async function writeManifest(config, entries) {
    const skippedCount = entries.filter((entry) => entry.skipped).length;
    const payload = {
        generatedAt: new Date().toISOString(),
        source: "local-generated",
        config,
        summary: {
            total: entries.length,
            skipped: skippedCount,
            generated: entries.length - skippedCount,
        },
        entries,
    };

    await fs.writeFile(MANIFEST_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function main() {
    const config = buildConfig();
    const sharp = loadSharp();

    await ensureDirs();

    const entries = [];
    for (let index = 1; index <= config.count; index += 1) {
        const entry = await processOne(index, config, sharp);
        entries.push(entry);
        if (index % 20 === 0 || index === config.count) {
            process.stdout.write(`processed ${index}/${config.count}\n`);
        }
    }

    await writeManifest(config, entries);

    const skipped = entries.filter((entry) => entry.skipped).length;
    process.stdout.write(`done: total=${entries.length}, generated=${entries.length - skipped}, skipped=${skipped}\n`);
    process.stdout.write(`manifest: ${MANIFEST_PATH}\n`);
}

main().catch((err) => {
    console.error("gen_assets_avatars_webp failed:", err);
    process.exitCode = 1;
});
