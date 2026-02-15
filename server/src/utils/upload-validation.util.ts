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

/**
 * 업로드 검증 유틸입니다.
 *
 * 제공 기능:
 * - 확장자 allowlist 검증(첨부파일)
 * - 매직넘버(signature) 기반 파일 타입 검증(이미지/첨부파일)
 *
 * 설계:
 * - 검증 정책은 `lab-options.json`의 `uploadValidation.*` 설정에 의해 켜고 끌 수 있습니다.
 * - 컨트롤러는 이 유틸을 이용해 "파일이 실제로 기대한 형식인지"를 확인합니다.
 */

/**
 * 첨부파일 확장자 검증을 활성화할지 여부를 반환합니다.
 */
export function isExtensionCheckEnabled(): boolean {
    return getLabOptions().uploadValidation.extensionCheckEnabled;
}

/**
 * 매직넘버(파일 시그니처) 검증을 활성화할지 여부를 반환합니다.
 */
export function isMagicNumberCheckEnabled(): boolean {
    return getLabOptions().uploadValidation.magicNumberCheckEnabled;
}

/**
 * 업로드된 파일명(originalname)에서 확장자를 추출하고 allowlist에 포함되는지 검증합니다.
 *
 * @param originalname 업로드 원본 파일명
 * @param allowedExtensions 허용 확장자 집합(예: .pdf, .zip)
 * @returns 소문자 확장자(예: ".pdf")
 */
export function validateAllowedExtension(originalname: string, allowedExtensions: ReadonlySet<string>): string {
    const extension = path.extname(originalname).toLowerCase();
    if (!allowedExtensions.has(extension)) {
        throw new Error("Unsupported attachment extension.");
    }
    return extension;
}

export type AttachmentExpectation = "pdf" | "zip" | "text";

/**
 * 첨부파일이 어떤 타입으로 검증되어야 하는지 결정합니다.
 *
 * - `trustExtension=true`이면 확장자를 우선 신뢰하고 기대 타입을 정합니다.
 * - 그렇지 않으면 mimetype을 기반으로 기대 타입을 정합니다.
 *
 * @returns 기대 타입 또는 지원 불가(null)
 */
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

/**
 * 이미지 파일의 매직넘버를 검증합니다.
 * jpeg/png/webp만 허용합니다.
 *
 * @throws 유효하지 않으면 Error("Invalid image data.")
 */
export function validateMagicNumberForImage(buffer: Buffer): void {
    const ok = isJpegSignature(buffer) || isPngSignature(buffer) || isWebpSignature(buffer);
    if (!ok) {
        throw new Error("Invalid image data.");
    }
}

/**
 * 첨부파일의 매직넘버를 기대 타입에 맞게 검증합니다.
 *
 * - pdf: `%PDF-` 시그니처 + tail의 `%%EOF` 등 라이트 sanity check
 * - zip: PK 시그니처
 * - text: UTF-8 텍스트로 보이는지 검사(바이너리 마커 차단 포함)
 */
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
