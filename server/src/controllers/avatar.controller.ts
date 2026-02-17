import type { Request, Response, NextFunction } from "express";
import path from "node:path";
import sharp from "sharp";
import { findUserProfileById, updateUserProfileImage } from "../services/profile.service.js";
import {
    AVATAR_IMAGE_ALLOWED_MIME_TYPES,
    AVATAR_IMAGE_MAX_BYTES,
    AVATAR_IMAGE_MAX_DIMENSION,
    AVATAR_IMAGE_MIN_DIMENSION,
    AVATAR_IMAGE_OUTPUT_QUALITY,
    AVATAR_IMAGE_OUTPUT_SIZE,
    AVATAR_IMAGE_UPLOAD_DIR,
} from "../constants/upload-avatar.constants.js";
import { HttpError } from "../utils/http-error.js";
import { ensureDir, safeUnlink } from "../utils/fs.util.js";
import { isMagicNumberCheckEnabled, validateMagicNumberForImage } from "../utils/upload-validation.util.js";

/**
 * 아바타(프로필 이미지) 업로드/삭제 컨트롤러입니다.
 *
 * 책임:
 * - 업로드 파일 검증(크기/타입/매직넘버/해상도)
 * - 이미지 변환 및 파일 시스템 저장
 * - 사용자 프로필 이미지 URL(DB) 업데이트 및 세션 반영
 *
 * 주의:
 * - DB 업데이트는 `profile.service`로 위임합니다.
 * - 파일 시스템 작업은 실패 가능성이 높으므로, 예외 처리 흐름을 명확히 유지합니다.
 *
 * 구조 메모:
 * - 현재는 단일 컨트롤러 파일로 유지합니다.
 * - `user.controller`와 세션/프로필 렌더 일부가 유사하지만,
 *   이 파일은 `next(HttpError)` 기반 분기가 있어 단순 helper 병합 시 흐름이 오히려 복잡해질 수 있습니다.
 */

/**
 * 아바타 처리 중 발생한 오류를 동일한 프로필 설정 화면으로 되돌려 보여줍니다.
 * CSRF 토큰을 포함해 렌더링합니다.
 */
async function renderAvatarError(
    req: Request,
    res: Response,
    next: NextFunction,
    status: number,
    message: string
) {
    try {
        const userId = Number(req.session.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return next(new HttpError(401, "Unauthorized"));
        }

        const profile = await findUserProfileById(userId);
        if (!profile) {
            return next(new HttpError(404, "User not found"));
        }

        return res.status(status).render("settings/profile", {
            formError: null,
            avatarError: message,
            profile: {
                username: profile.username,
                displayName: profile.displayName,
                email: profile.email,
                phoneNumber: profile.phoneNumber,
                bio: profile.bio,
            },
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * 아바타 업로드 요청을 처리합니다.
 *
 * 처리:
 * - 세션 로그인 확인
 * - 파일 검증 및 webp 변환/리사이즈
 * - DB의 profileImageUrl 업데이트 + 세션 동기화
 * - 이전 아바타 파일 정리(best-effort)
 */
export async function postAvatarUpload(req: Request, res: Response, next: NextFunction) {
    const userId = Number(req.session.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
        throw new HttpError(401, "Unauthorized");
    }

    const file = req.file;
    if (!file) {
        return renderAvatarError(req, res, next, 400, "Avatar file is required.");
    }

    // 파일 확장자/Content-Type은 신뢰할 수 없습니다.
    // 실습 옵션에 따라 매직넘버 검사로 실제 바이너리 시그니처를 확인합니다.
    if (isMagicNumberCheckEnabled()) {
        try {
            validateMagicNumberForImage(file.buffer);
        } catch {
            return renderAvatarError(req, res, next, 422, "Invalid image data.");
        }
    }

    // 업로드된 mimetype은 조작 가능하지만, UI 상의 빠른 피드백을 위해 1차로 제한합니다.
    if (!AVATAR_IMAGE_ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return renderAvatarError(req, res, next, 422, "Unsupported image type.");
    }

    // 메모리 스토리지를 사용하므로 파일 크기 제한은 서버 안정성에 직접 영향이 있습니다.
    if (file.size > AVATAR_IMAGE_MAX_BYTES) {
        return renderAvatarError(req, res, next, 413, "Avatar file is too large.");
    }

    // sharp는 디코딩 비용이 크므로, 과도한 픽셀 입력을 제한합니다.
    const image = sharp(file.buffer, {
        limitInputPixels: AVATAR_IMAGE_MAX_DIMENSION * AVATAR_IMAGE_MAX_DIMENSION,
    });
    const metadata = await image.metadata();

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (!width || !height) {
        return renderAvatarError(req, res, next, 422, "Invalid image data.");
    }
    if (width > AVATAR_IMAGE_MAX_DIMENSION || height > AVATAR_IMAGE_MAX_DIMENSION) {
        return renderAvatarError(req, res, next, 422, "Image dimensions exceed the limit.");
    }
    if (width < AVATAR_IMAGE_MIN_DIMENSION || height < AVATAR_IMAGE_MIN_DIMENSION) {
        return renderAvatarError(req, res, next, 422, "Image dimensions are too small.");
    }

    // 업로드 경로가 없으면 생성합니다. (ensureDir는 idempotent)
    await ensureDir(AVATAR_IMAGE_UPLOAD_DIR);

    // 파일명은 userId + timestamp 기반으로 충돌 가능성을 낮춥니다.
    const filename = `user-${userId}-${Date.now()}.webp`;
    const outputPath = path.join(AVATAR_IMAGE_UPLOAD_DIR, filename);

    // 출력은 고정 사이즈(정사각형)로 잘라내며, webp로 통일합니다.
    await image
        .resize(AVATAR_IMAGE_OUTPUT_SIZE, AVATAR_IMAGE_OUTPUT_SIZE, { fit: "cover", position: "centre" })
        .webp({ quality: AVATAR_IMAGE_OUTPUT_QUALITY })
        .toFile(outputPath);

    // DB 업데이트는 "저장 완료 후" 수행해, DB에만 파일명이 남고 파일이 없는 상태를 줄입니다.
    const existing = await findUserProfileById(userId);
    await updateUserProfileImage({ userId, profileImageUrl: filename });
    req.session.profileImageUrl = filename;

    // 이전 파일 삭제는 best-effort로 처리합니다(실패해도 업로드 성공을 깨지 않음).
    if (existing?.profileImageUrl) {
        const previousName = path.basename(existing.profileImageUrl);
        const previousPath = path.join(AVATAR_IMAGE_UPLOAD_DIR, previousName);
        if (previousName !== filename) {
            await safeUnlink(previousPath);
        }
    }

    // referer는 신뢰할 수 없지만, UX를 위해 "돌아가기" 용도로만 사용합니다.
    // 필요 시 allowlist 기반으로 제한할 수 있습니다.
    const redirectTarget = req.get("referer") ?? `/@${req.session.username ?? ""}`;
    return res.redirect(redirectTarget);
}

/**
 * 아바타 삭제 요청을 처리합니다.
 *
 * 처리:
 * - DB의 profileImageUrl을 null로 업데이트 + 세션 동기화
 * - 기존 파일이 있으면 삭제(best-effort)
 */
export async function postAvatarDelete(req: Request, res: Response) {
    const userId = Number(req.session.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
        throw new HttpError(401, "Unauthorized");
    }

    // 기존 파일명을 먼저 읽어두고, DB부터 갱신한 뒤 파일은 best-effort로 제거합니다.
    const profile = await findUserProfileById(userId);
    await updateUserProfileImage({ userId, profileImageUrl: null });
    req.session.profileImageUrl = null;

    if (profile?.profileImageUrl) {
        const previousName = path.basename(profile.profileImageUrl);
        const previousPath = path.join(AVATAR_IMAGE_UPLOAD_DIR, previousName);
        await safeUnlink(previousPath);
    }

    // 업로드와 동일하게, 가능한 경우 원래 페이지로 되돌립니다.
    const redirectTarget = req.get("referer") ?? `/@${req.session.username ?? ""}`;
    return res.redirect(redirectTarget);
}
