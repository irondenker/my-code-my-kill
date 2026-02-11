import path from "node:path";
import { getLabOptions } from "../config/lab-options.js";
import {
    assertLooksLikeUtf8Text,
    isJpegSignature,
    isPdfSignature,
    looksLikePdf,
    isPngSignature,
    isWebpSignature,
    isZipSignature,
} from "./file-signature.util.js";

export function isExtensionCheckEnabled(): boolean {
    return getLabOptions().uploadValidation.extensionCheckEnabled;
}

export function isMagicNumberCheckEnabled(): boolean {
    return getLabOptions().uploadValidation.magicNumberCheckEnabled;
}

export function validateAllowedExtension(originalname: string, allowedExtensions: ReadonlySet<string>): string {
    const extension = path.extname(originalname).toLowerCase();
    if (!allowedExtensions.has(extension)) {
        throw new Error("Unsupported attachment extension.");
    }
    return extension;
}

export type AttachmentExpectation = "pdf" | "zip" | "text";

export function resolveAttachmentExpectation(args: { extension: string; mimetype: string; trustExtension: boolean }): AttachmentExpectation | null {
    const ext = args.extension;
    if (args.trustExtension) {
        if (ext === ".pdf") return "pdf";
        if (ext === ".zip") return "zip";
        if (ext === ".txt" || ext === ".csv") return "text";
    }

    const mime = args.mimetype;
    if (mime === "application/pdf") return "pdf";
    if (mime === "application/zip" || mime === "application/x-zip-compressed") return "zip";
    if (mime === "text/plain" || mime === "text/csv" || mime === "application/vnd.ms-excel") return "text";

    return null;
}

export function validateMagicNumberForImage(buffer: Buffer): void {
    const ok = isJpegSignature(buffer) || isPngSignature(buffer) || isWebpSignature(buffer);
    if (!ok) {
        throw new Error("Invalid image data.");
    }
}

export function validateMagicNumberForAttachment(buffer: Buffer, expectation: AttachmentExpectation): void {
    if (expectation === "pdf") {
        if (!isPdfSignature(buffer)) {
            throw new Error("Unsupported attachment type.");
        }
        if (!looksLikePdf(buffer)) {
            throw new Error("Invalid attachment data.");
        }
        return;
    }

    if (expectation === "zip") {
        if (!isZipSignature(buffer)) {
            throw new Error("Unsupported attachment type.");
        }
        return;
    }

    assertLooksLikeUtf8Text(buffer);
}
