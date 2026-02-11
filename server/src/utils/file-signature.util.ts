type ByteArray = Uint8Array | Buffer;

function hasBytesAt(buf: ByteArray, offset: number, bytes: readonly number[]): boolean {
    if (offset < 0) return false;
    if (buf.length < offset + bytes.length) return false;
    for (let i = 0; i < bytes.length; i += 1) {
        if (buf[offset + i] !== bytes[i]) return false;
    }
    return true;
}

export function isJpegSignature(buf: ByteArray): boolean {
    // FF D8 FF
    return hasBytesAt(buf, 0, [0xff, 0xd8, 0xff]);
}

export function isPngSignature(buf: ByteArray): boolean {
    // 89 50 4E 47 0D 0A 1A 0A
    return hasBytesAt(buf, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

export function isWebpSignature(buf: ByteArray): boolean {
    // "RIFF" .... "WEBP"
    return hasBytesAt(buf, 0, [0x52, 0x49, 0x46, 0x46]) && hasBytesAt(buf, 8, [0x57, 0x45, 0x42, 0x50]);
}

export function isPdfSignature(buf: ByteArray): boolean {
    // "%PDF-"
    return hasBytesAt(buf, 0, [0x25, 0x50, 0x44, 0x46, 0x2d]);
}

export function isZipSignature(buf: ByteArray): boolean {
    // "PK" + (local file header / end of central directory / spanned archive)
    if (!hasBytesAt(buf, 0, [0x50, 0x4b])) return false;
    if (buf.length < 4) return false;
    const b2 = buf[2];
    const b3 = buf[3];
    return (
        (b2 === 0x03 && b3 === 0x04) ||
        (b2 === 0x05 && b3 === 0x06) ||
        (b2 === 0x07 && b3 === 0x08)
    );
}

export function looksLikePdf(buffer: Buffer): boolean {
    if (!isPdfSignature(buffer)) return false;
    // Light sanity check: for most PDFs, "%%EOF" appears near the end.
    const tailSize = Math.min(buffer.length, 2048);
    const tail = buffer.subarray(buffer.length - tailSize);
    return tail.includes("%%EOF");
}

export type TextLooksLikeOptions = {
    sampleBytes?: number;
    maxControlCharRatio?: number;
};

function sliceSamples(buffer: Buffer, sampleBytes: number): Buffer[] {
    if (buffer.length <= sampleBytes) return [buffer];
    if (buffer.length <= sampleBytes * 2) return [buffer.subarray(0, sampleBytes)];
    return [buffer.subarray(0, sampleBytes), buffer.subarray(buffer.length - sampleBytes)];
}

function countSuspiciousControlChars(text: string): { suspicious: number; total: number } {
    let suspicious = 0;
    let total = 0;
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        total += 1;
        // Allow common whitespace controls only.
        if (code === 0x09 || code === 0x0a || code === 0x0d) continue;
        if (code < 0x20 || code === 0x7f) suspicious += 1;
    }
    return { suspicious, total };
}

export function assertLooksLikeUtf8Text(buffer: Buffer, options: TextLooksLikeOptions = {}): void {
    const sampleBytes = options.sampleBytes ?? 64 * 1024;
    const maxControlCharRatio = options.maxControlCharRatio ?? 0.02;

    // A lot of binary formats can still be valid UTF-8. Block obvious binary markers first.
    if (buffer.includes(0x00)) {
        throw new Error("Attachment is not a valid text file (contains NUL bytes).");
    }
    if (isPdfSignature(buffer) || isZipSignature(buffer) || isJpegSignature(buffer) || isPngSignature(buffer) || isWebpSignature(buffer)) {
        throw new Error("Attachment is not a valid text file (looks like a binary format).");
    }

    const decoder = new TextDecoder("utf-8", { fatal: true });
    const samples = sliceSamples(buffer, sampleBytes);

    let suspicious = 0;
    let total = 0;
    for (const sample of samples) {
        let decoded: string;
        try {
            decoded = decoder.decode(sample);
        } catch {
            throw new Error("Attachment is not a valid UTF-8 text file.");
        }

        const counts = countSuspiciousControlChars(decoded);
        suspicious += counts.suspicious;
        total += counts.total;
    }

    if (total > 0 && suspicious / total > maxControlCharRatio) {
        throw new Error("Attachment is not a valid text file (too many control characters).");
    }
}

