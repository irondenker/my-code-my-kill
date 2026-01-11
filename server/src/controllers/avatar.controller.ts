import type { Request, Response, NextFunction } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { findUserProfileById, updateUserProfileImage } from "../services/auth.service.js";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 2048;
const MIN_DIMENSION = 128;
const OUTPUT_SIZE = 512;
const OUTPUT_QUALITY = 80;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");

async function ensureUploadDir() {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function postAvatarUpload(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = Number(req.session.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(401).send("Unauthorized");
        }

        const file = req.file;
        if (!file) {
            return res.status(400).send("Avatar file is required.");
        }

        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            return res.status(400).send("Unsupported image type.");
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            return res.status(413).send("Avatar file is too large.");
        }

        const image = sharp(file.buffer, {
            limitInputPixels: MAX_DIMENSION * MAX_DIMENSION,
        });
        const metadata = await image.metadata();

        const width = metadata.width ?? 0;
        const height = metadata.height ?? 0;
        if (!width || !height) {
            return res.status(400).send("Invalid image data.");
        }
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            return res.status(400).send("Image dimensions exceed the limit.");
        }
        if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
            return res.status(400).send("Image dimensions are too small.");
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
            return res.status(401).send("Unauthorized");
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
