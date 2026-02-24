#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const REPO_ROOT = path.resolve(__dirname, "..");
const SEED_ASSET_ROOT = path.join(REPO_ROOT, "seed-assets");
const RAW_DIR = path.join(SEED_ASSET_ROOT, "raw", "files");
const MANIFEST_DIR = path.join(SEED_ASSET_ROOT, "manifest");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "files.json");
const WHITELIST_SOURCE_PATH = path.join(REPO_ROOT, "server", "src", "constants", "upload-article.constants.ts");

const DEFAULTS = {
    count: 300,
    seed: "mcmk-files-v1",
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
        count: Math.max(1, toInt(getArgValue("count", process.env.ASSETS_FILE_COUNT ?? DEFAULTS.count), DEFAULTS.count)),
        seed: String(getArgValue("seed", process.env.ASSETS_FILE_SEED ?? DEFAULTS.seed)),
    };
}

function seedToRng(seedText) {
    let state = crypto.createHash("sha256").update(seedText).digest().readUInt32BE(0) >>> 0;
    return function next() {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

async function sha256File(filePath) {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function ensureDirs() {
    await fs.mkdir(RAW_DIR, { recursive: true });
    await fs.mkdir(MANIFEST_DIR, { recursive: true });
}

function parseAllowedExtensions(sourceText) {
    const setPattern = /ARTICLE_ATTACHMENT_EXTENSIONS[^=]*=\s*new Set\(\s*\[([\s\S]*?)\]\s*\)/m;
    const match = sourceText.match(setPattern);
    if (!match || !match[1]) {
        throw new Error("Could not parse ARTICLE_ATTACHMENT_EXTENSIONS from upload-article.constants.ts");
    }

    const extensions = new Set();
    const itemPattern = /"(\.[a-z0-9]+)"/gi;
    let itemMatch = itemPattern.exec(match[1]);
    while (itemMatch) {
        extensions.add(itemMatch[1].toLowerCase());
        itemMatch = itemPattern.exec(match[1]);
    }

    if (extensions.size === 0) {
        throw new Error("No allowed attachment extensions found.");
    }

    return Array.from(extensions).sort();
}

function makeTextContent(kind, index) {
    const lines = {
        txt: [
            `Notice #${index}`,
            "This is a sample text attachment for seed data.",
            "Topic: upload validation and safe defaults.",
            "Status: reviewed",
        ],
        md: [
            `# Memo ${index}`,
            "- type: markdown",
            "- scope: seed assets",
            "- note: generated offline",
        ],
        csv: [
            "id,category,status",
            `${index},announcement,open`,
            `${index + 1},question,closed`,
            `${index + 2},review,pending`,
        ],
        json: [
            JSON.stringify(
                {
                    version: 1,
                    generated: true,
                    index,
                    tags: ["seed", "attachment", "safe"],
                },
                null,
                2
            ),
        ],
    };

    return `${(lines[kind] || lines.txt).join("\n")}\n`;
}

function createMinimalPdfBuffer(index) {
    const text = `Seed Document ${index}`;
    const header = "%PDF-1.4\n";
    const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
    const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
    const obj3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << >> >>\nendobj\n";
    const stream = `BT /F1 12 Tf 24 150 Td (${text}) Tj ET`;
    const obj4 = `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;

    const body = `${obj1}${obj2}${obj3}${obj4}`;
    const xrefOffset = Buffer.byteLength(`${header}${body}`, "utf8");

    const xref = [
        "xref",
        "0 5",
        "0000000000 65535 f ",
        "0000000010 00000 n ",
        "0000000061 00000 n ",
        "0000000118 00000 n ",
        "0000000222 00000 n ",
    ].join("\n");

    const trailer = `\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    return Buffer.from(`${header}${body}${xref}${trailer}`, "utf8");
}

function buildCrcTable() {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
        let c = i;
        for (let k = 0; k < 8; k += 1) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
    }
    return table;
}

const CRC_TABLE = buildCrcTable();

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const b of buffer) {
        crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function createSimpleZipBuffer(filenameInZip, contentBuffer) {
    const filenameBuffer = Buffer.from(filenameInZip, "utf8");
    const crc = crc32(contentBuffer);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(filenameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localPart = Buffer.concat([localHeader, filenameBuffer, contentBuffer]);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(contentBuffer.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(filenameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(0, 42);

    const centralPart = Buffer.concat([centralHeader, filenameBuffer]);

    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(1, 8);
    end.writeUInt16LE(1, 10);
    end.writeUInt32LE(centralPart.length, 12);
    end.writeUInt32LE(localPart.length, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([localPart, centralPart, end]);
}

function makeGeneratorForExtension(extension) {
    if (extension === ".txt") {
        return (index) => Buffer.from(makeTextContent("txt", index), "utf8");
    }
    if (extension === ".md") {
        return (index) => Buffer.from(makeTextContent("md", index), "utf8");
    }
    if (extension === ".csv") {
        return (index) => Buffer.from(makeTextContent("csv", index), "utf8");
    }
    if (extension === ".json") {
        return (index) => Buffer.from(makeTextContent("json", index), "utf8");
    }
    if (extension === ".pdf") {
        return (index) => createMinimalPdfBuffer(index);
    }
    if (extension === ".zip") {
        return (index) => {
            const inner = Buffer.from(makeTextContent("txt", index), "utf8");
            return createSimpleZipBuffer(`note-${index}.txt`, inner);
        };
    }
    return null;
}

function buildPlan(extensions, totalCount) {
    const perExt = Math.floor(totalCount / extensions.length);
    const remainder = totalCount % extensions.length;
    return extensions.map((extension, idx) => ({
        extension,
        count: perExt + (idx < remainder ? 1 : 0),
    }));
}

function fileNameFor(extension, globalIndex) {
    const safeExt = extension.replace(/^\./, "");
    return `dummy_${safeExt}_${String(globalIndex).padStart(4, "0")}${extension}`;
}

async function processOne(extension, seqIndex, globalIndex, generator) {
    const filename = fileNameFor(extension, globalIndex);
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
        const buffer = generator(seqIndex);
        await fs.writeFile(outputPath, buffer);
    }

    const stats = await fs.stat(outputPath);
    const sha256 = await sha256File(outputPath);

    return {
        extension,
        relativePath: path.posix.join("raw", "files", filename),
        size: stats.size,
        sha256,
        skipped,
    };
}

async function writeManifest(config, allowedExtensions, entries, unsupported) {
    const skippedCount = entries.filter((entry) => entry.skipped).length;
    const payload = {
        generatedAt: new Date().toISOString(),
        sourceWhitelistPath: path.relative(REPO_ROOT, WHITELIST_SOURCE_PATH).replace(/\\/g, "/"),
        allowedExtensions,
        unsupportedExtensions: unsupported,
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
    const whitelistSource = await fs.readFile(WHITELIST_SOURCE_PATH, "utf8");
    const allowedExtensions = parseAllowedExtensions(whitelistSource);

    const supportedExtensions = [];
    const unsupportedExtensions = [];
    const generatorByExt = new Map();

    for (const ext of allowedExtensions) {
        const generator = makeGeneratorForExtension(ext);
        if (!generator) {
            unsupportedExtensions.push(ext);
            continue;
        }
        supportedExtensions.push(ext);
        generatorByExt.set(ext, generator);
    }

    if (supportedExtensions.length === 0) {
        throw new Error("No supported extension generator matched the attachment whitelist.");
    }

    await ensureDirs();

    const plan = buildPlan(supportedExtensions, config.count);
    const entries = [];
    const rng = seedToRng(config.seed);

    let globalIndex = 1;
    for (const item of plan) {
        const generator = generatorByExt.get(item.extension);
        if (!generator) {
            continue;
        }

        for (let i = 0; i < item.count; i += 1) {
            const seqIndex = 1 + i + Math.floor(rng() * 3);
            const entry = await processOne(item.extension, seqIndex, globalIndex, generator);
            entries.push(entry);
            if (globalIndex % 50 === 0 || globalIndex === config.count) {
                process.stdout.write(`processed ${globalIndex}/${config.count}\n`);
            }
            globalIndex += 1;
        }
    }

    await writeManifest(config, allowedExtensions, entries, unsupportedExtensions);

    const skipped = entries.filter((entry) => entry.skipped).length;
    process.stdout.write(`done: total=${entries.length}, generated=${entries.length - skipped}, skipped=${skipped}\n`);
    process.stdout.write(`whitelist=${allowedExtensions.join(", ")}\n`);
    if (unsupportedExtensions.length > 0) {
        process.stdout.write(`unsupported (skipped): ${unsupportedExtensions.join(", ")}\n`);
    }
    process.stdout.write(`manifest: ${MANIFEST_PATH}\n`);
}

main().catch((err) => {
    console.error("gen_assets_files failed:", err);
    process.exitCode = 1;
});
