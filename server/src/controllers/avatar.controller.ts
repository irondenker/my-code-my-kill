import type { Request, Response, NextFunction } from "express";
import path from "node:path";
import sharp from "sharp";
import csrf from "csurf";
import { findUserProfileById, updateUserProfileImage } from "../services/profile.service.js";
import { ALLOWED_MIME_TYPES, MAX_DIMENSION, MAX_FILE_SIZE_BYTES, MIN_DIMENSION, OUTPUT_QUALITY, OUTPUT_SIZE, UPLOAD_DIR } from "../constants/upload.constants.js";
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
 */

/**
 * 아바타 업로드 실패 시에도 동일한 뷰에서 CSRF 토큰이 필요하므로,
 * 렌더링용 CSRF 미들웨어를 별도로 둡니다.
 *
 * 주의:
 * - 업로드는 multipart/form-data 이므로, 라우트에서 `multer` 이후에 CSRF를 적용합니다.
 */
const csrfForRender = csrf({ ignoreMethods: ["POST"] });

/**
 * 업로드 디렉토리가 없으면 생성합니다.
 * 업로드가 자주 발생할 수 있으므로 `recursive: true`로 idempotent하게 처리합니다.
 */
async function ensureUploadDir() {
    await ensureDir(UPLOAD_DIR);
}

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
    csrfForRender(req, res, async (csrfErr) => {
        if (csrfErr) return next(csrfErr);

        try {
            const userId = Number(req.session.userId);
            if (!Number.isFinite(userId) || userId <= 0) {
                return next(new HttpError(401, "Unauthorized"));
            }

            const profile = await findUserProfileById(userId);
            if (!profile) {
                return next(new HttpError(404, "User not found"));
            }

            const csrfToken = typeof req.csrfToken === "function" ? req.csrfToken() : null;

            return res.status(status).render("settings/profile", {
                formError: null,
                avatarError: message,
                csrfToken,
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
    });
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
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return renderAvatarError(req, res, next, 422, "Unsupported image type.");
    }

    // 메모리 스토리지를 사용하므로 파일 크기 제한은 서버 안정성에 직접 영향이 있습니다.
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return renderAvatarError(req, res, next, 413, "Avatar file is too large.");
    }

    // sharp는 디코딩 비용이 크므로, 과도한 픽셀 입력을 제한합니다.
    const image = sharp(file.buffer, {
        limitInputPixels: MAX_DIMENSION * MAX_DIMENSION,
    });
    const metadata = await image.metadata();

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (!width || !height) {
        return renderAvatarError(req, res, next, 422, "Invalid image data.");
    }
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        return renderAvatarError(req, res, next, 422, "Image dimensions exceed the limit.");
    }
    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
        return renderAvatarError(req, res, next, 422, "Image dimensions are too small.");
    }

    await ensureUploadDir();

    // 파일명은 userId + timestamp 기반으로 충돌 가능성을 낮춥니다.
    const filename = `user-${userId}-${Date.now()}.webp`;
    const outputPath = path.join(UPLOAD_DIR, filename);

    // 출력은 고정 사이즈(정사각형)로 잘라내며, webp로 통일합니다.
    await image
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover", position: "centre" })
        .webp({ quality: OUTPUT_QUALITY })
        .toFile(outputPath);

    // DB 업데이트는 "저장 완료 후" 수행해, DB에만 파일명이 남고 파일이 없는 상태를 줄입니다.
    const existing = await findUserProfileById(userId);
    await updateUserProfileImage({ userId, profileImageUrl: filename });
    req.session.profileImageUrl = filename;

    // 이전 파일 삭제는 best-effort로 처리합니다(실패해도 업로드 성공을 깨지 않음).
    if (existing?.profileImageUrl) {
        const previousName = path.basename(existing.profileImageUrl);
        const previousPath = path.join(UPLOAD_DIR, previousName);
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
        const previousPath = path.join(UPLOAD_DIR, previousName);
        await safeUnlink(previousPath);
    }

    // 업로드와 동일하게, 가능한 경우 원래 페이지로 되돌립니다.
    const redirectTarget = req.get("referer") ?? `/@${req.session.username ?? ""}`;
    return res.redirect(redirectTarget);
}
