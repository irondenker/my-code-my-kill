import assert from "node:assert/strict";
import test from "node:test";
import {
    resolveAttachmentExpectation,
    validateAllowedExtension,
    validateMagicNumberForAttachment,
    validateMagicNumberForImage,
} from "../../../utils/upload-validation.util.js";

test("validateAllowedExtension normalizes extension to lowercase", () => {
    const allowed = new Set([".pdf", ".zip"]);
    assert.equal(validateAllowedExtension("Report.PDF", allowed), ".pdf");
});

test("validateAllowedExtension throws for unsupported extension", () => {
    const allowed = new Set([".pdf", ".zip"]);
    assert.throws(() => validateAllowedExtension("payload.exe", allowed), /Unsupported attachment extension/);
});

test("resolveAttachmentExpectation prefers extension when trustExtension=true", () => {
    assert.equal(resolveAttachmentExpectation({
        extension: ".pdf",
        mimetype: "text/plain",
        trustExtension: true,
    }), "pdf");

    assert.equal(resolveAttachmentExpectation({
        extension: ".txt",
        mimetype: "application/pdf",
        trustExtension: true,
    }), "text");
});

test("resolveAttachmentExpectation falls back to mimetype when trustExtension=false", () => {
    assert.equal(resolveAttachmentExpectation({
        extension: ".unknown",
        mimetype: "application/pdf",
        trustExtension: false,
    }), "pdf");

    assert.equal(resolveAttachmentExpectation({
        extension: ".unknown",
        mimetype: "application/x-zip-compressed",
        trustExtension: false,
    }), "zip");

    assert.equal(resolveAttachmentExpectation({
        extension: ".unknown",
        mimetype: "application/octet-stream",
        trustExtension: false,
    }), null);
});

test("validateMagicNumberForImage accepts png/jpeg/webp and rejects other formats", () => {
    assert.doesNotThrow(() => validateMagicNumberForImage(Buffer.from([0xff, 0xd8, 0xff, 0x00])));
    assert.doesNotThrow(() => validateMagicNumberForImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));
    assert.doesNotThrow(() => validateMagicNumberForImage(Buffer.from("RIFF1234WEBP", "ascii")));

    assert.throws(() => validateMagicNumberForImage(Buffer.from("not-image", "utf8")), /Invalid image data/);
});

test("validateMagicNumberForAttachment validates by expectation", () => {
    assert.doesNotThrow(() => {
        validateMagicNumberForAttachment(Buffer.from("%PDF-1.7\nx\n%%EOF", "ascii"), "pdf");
    });

    assert.throws(() => {
        validateMagicNumberForAttachment(Buffer.from("%PDF-1.7\nx\nNOEOF", "ascii"), "pdf");
    }, /Invalid attachment data/);

    assert.doesNotThrow(() => {
        validateMagicNumberForAttachment(Buffer.from([0x50, 0x4b, 0x03, 0x04]), "zip");
    });

    assert.throws(() => {
        validateMagicNumberForAttachment(Buffer.from("not-zip", "utf8"), "zip");
    }, /Unsupported attachment type/);

    assert.doesNotThrow(() => {
        validateMagicNumberForAttachment(Buffer.from("hello,text\n", "utf8"), "text");
    });
});
