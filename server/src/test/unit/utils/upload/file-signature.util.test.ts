import assert from "node:assert/strict";
import test from "node:test";
import {
    assertLooksLikeUtf8Text,
    isJpegSignature,
    isPdfSignature,
    isPngSignature,
    isWebpSignature,
    isZipSignature,
    looksLikePdf,
} from "../../../../utils/upload/file-signature.util.js";

test("signature helpers detect known file signatures", () => {
    assert.equal(isJpegSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00])), true);
    assert.equal(isPngSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
    assert.equal(isWebpSignature(Buffer.from("RIFF1234WEBP", "ascii")), true);
    assert.equal(isPdfSignature(Buffer.from("%PDF-1.7", "ascii")), true);
    assert.equal(isZipSignature(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])), true);
});

test("looksLikePdf requires both header and EOF marker", () => {
    const valid = Buffer.from("%PDF-1.7\n1 0 obj\n%%EOF", "ascii");
    const invalid = Buffer.from("%PDF-1.7\n1 0 obj\nNOEOF", "ascii");

    assert.equal(looksLikePdf(valid), true);
    assert.equal(looksLikePdf(invalid), false);
});

test("assertLooksLikeUtf8Text accepts normal utf-8 text", () => {
    assert.doesNotThrow(() => {
        assertLooksLikeUtf8Text(Buffer.from("hello\nworld\n", "utf8"));
    });
});

test("assertLooksLikeUtf8Text rejects buffers containing NUL bytes", () => {
    assert.throws(() => {
        assertLooksLikeUtf8Text(Buffer.from([0x68, 0x00, 0x69]));
    }, /contains NUL bytes/);
});

test("assertLooksLikeUtf8Text rejects binary signature data", () => {
    assert.throws(() => {
        assertLooksLikeUtf8Text(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }, /binary format/);
});

test("assertLooksLikeUtf8Text rejects invalid utf-8 sequence", () => {
    assert.throws(() => {
        assertLooksLikeUtf8Text(Buffer.from([0xc3, 0x28]));
    }, /valid UTF-8/);
});
