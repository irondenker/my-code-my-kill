import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { after, test } from "node:test";
import sharp from "sharp";
import {
    ARTICLE_ATTACHMENT_UPLOAD_DIR,
    ARTICLE_IMAGE_UPLOAD_DIR,
} from "../../../constants/upload-article.constants.js";
import {
    deleteStoredArticleAttachment,
    deleteStoredArticleImage,
    storeArticleAttachment,
    storeArticleImage,
} from "../../../services/article/article-upload.service.js";

const createdImageFiles = new Set<string>();
const createdAttachmentFiles = new Set<string>();

after(async () => {
    await Promise.all(
        Array.from(createdImageFiles, (filename) => deleteStoredArticleImage(filename))
    );
    await Promise.all(
        Array.from(createdAttachmentFiles, (filename) => deleteStoredArticleAttachment(filename))
    );
});

function makeUpload(overrides: Partial<Express.Multer.File>): Express.Multer.File {
    return {
        fieldname: "file",
        originalname: "file.txt",
        encoding: "7bit",
        mimetype: "text/plain",
        size: 0,
        destination: "",
        filename: "",
        path: "",
        buffer: Buffer.alloc(0),
        stream: null as any,
        ...overrides,
    };
}

test("storeArticleImage rejects unsupported mimetype", async () => {
    const file = makeUpload({
        originalname: "avatar.txt",
        mimetype: "text/plain",
        buffer: Buffer.from("not-an-image"),
        size: 12,
    });

    await assert.rejects(
        async () => storeArticleImage(file),
        /Invalid image data|Unsupported image type\./
    );
});

test("storeArticleImage stores webp output and deleteStoredArticleImage removes it", async () => {
    const pngBuffer = await sharp({
        create: {
            width: 32,
            height: 32,
            channels: 3,
            background: { r: 20, g: 40, b: 60 },
        },
    })
        .png()
        .toBuffer();

    const filename = await storeArticleImage(
        makeUpload({
            originalname: "photo.png",
            mimetype: "image/png",
            size: pngBuffer.length,
            buffer: pngBuffer,
        })
    );
    createdImageFiles.add(filename);

    assert.match(filename, /^article-image-.*\.webp$/);
    const outputPath = path.join(ARTICLE_IMAGE_UPLOAD_DIR, filename);
    await fs.access(outputPath);

    await deleteStoredArticleImage(filename);
    createdImageFiles.delete(filename);
    await assert.rejects(async () => fs.access(outputPath));
});

test("storeArticleAttachment rejects unsupported extension when extension check is enabled", async () => {
    const content = Buffer.from("plain text");
    const file = makeUpload({
        originalname: "bad.exe",
        mimetype: "text/plain",
        buffer: content,
        size: content.length,
    });

    await assert.rejects(
        async () => storeArticleAttachment(file),
        /Unsupported attachment extension\./
    );
});

test("storeArticleAttachment rejects invalid pdf signature", async () => {
    const bogusPdf = Buffer.from("not-a-real-pdf");
    const file = makeUpload({
        originalname: "doc.pdf",
        mimetype: "application/pdf",
        buffer: bogusPdf,
        size: bogusPdf.length,
    });

    await assert.rejects(
        async () => storeArticleAttachment(file),
        /Unsupported attachment type\./
    );
});

test("storeArticleAttachment stores and deletes utf-8 text attachment", async () => {
    const text = Buffer.from("hello,attachment\nline2", "utf8");
    const filename = await storeArticleAttachment(
        makeUpload({
            originalname: "memo.txt",
            mimetype: "text/plain",
            buffer: text,
            size: text.length,
        })
    );
    createdAttachmentFiles.add(filename);

    assert.match(filename, /^article-file-.*\.txt$/);
    const outputPath = path.join(ARTICLE_ATTACHMENT_UPLOAD_DIR, filename);
    await fs.access(outputPath);

    await deleteStoredArticleAttachment(filename);
    createdAttachmentFiles.delete(filename);
    await assert.rejects(async () => fs.access(outputPath));
});

