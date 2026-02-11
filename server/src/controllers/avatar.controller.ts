import type { Request, Response, NextFunction } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import csrf from "csurf";
import { findUserProfileById, updateUserProfileImage } from "../services/auth.service.js";
import { ALLOWED_MIME_TYPES, MAX_DIMENSION, MAX_FILE_SIZE_BYTES, MIN_DIMENSION, OUTPUT_QUALITY, OUTPUT_SIZE, UPLOAD_DIR } from "../constants/upload.constants.js";
import { HttpError } from "../utils/http-error.js";
import { isMagicNumberCheckEnabled, validateMagicNumberForImage } from "../utils/upload-validation.util.js";

const csrfForRender = csrf({ ignoreMethods: ["POST"] });

async function ensureUploadDir() {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

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

export async function postAvatarUpload(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = Number(req.session.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return next(new HttpError(401, "Unauthorized"));
        }

        const file = req.file;
        if (!file) {
            return renderAvatarError(req, res, next, 400, "Avatar file is required.");
        }

        if (isMagicNumberCheckEnabled()) {
            try {
                validateMagicNumberForImage(file.buffer);
            } catch {
                return renderAvatarError(req, res, next, 422, "Invalid image data.");
            }
        }

        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            return renderAvatarError(req, res, next, 422, "Unsupported image type.");
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            return renderAvatarError(req, res, next, 413, "Avatar file is too large.");
        }

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

        const filename = `user-${userId}-${Date.now()}.webp`;
        const outputPath = path.join(UPLOAD_DIR, filename);

        await image
            .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover", position: "centre" })
            .webp({ quality: OUTPUT_QUALITY })
            .toFile(outputPath);

        const existing = await findUserProfileById(userId);
        await updateUserProfileImage({ userId, profileImageUrl: filename });
        req.session.profileImageUrl = filename;

        if (existing?.profileImageUrl) {
            const previousName = path.basename(existing.profileImageUrl);
            const previousPath = path.join(UPLOAD_DIR, previousName);
            if (previousName !== filename) {
                await fs.unlink(previousPath).catch(() => undefined);
            }
        }

        const redirectTarget = req.get("referer") ?? `/@${req.session.username ?? ""}`;
        return res.redirect(redirectTarget);
    } catch (err) {
        return next(err);
    }
}

export async function postAvatarDelete(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = Number(req.session.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return next(new HttpError(401, "Unauthorized"));
        }

        const profile = await findUserProfileById(userId);
        await updateUserProfileImage({ userId, profileImageUrl: null });
        req.session.profileImageUrl = null;

        if (profile?.profileImageUrl) {
            const previousName = path.basename(profile.profileImageUrl);
            const previousPath = path.join(UPLOAD_DIR, previousName);
            await fs.unlink(previousPath).catch(() => undefined);
        }

        const redirectTarget = req.get("referer") ?? `/@${req.session.username ?? ""}`;
        return res.redirect(redirectTarget);
    } catch (err) {
        return next(err);
    }
}
