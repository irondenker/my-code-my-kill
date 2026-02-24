import path from "node:path";
import sharp from "sharp";
import { findUserProfileById, updateUserProfileImage } from "../profile.service.js";
import {
    AVATAR_IMAGE_ALLOWED_MIME_TYPES,
    AVATAR_IMAGE_MAX_BYTES,
    AVATAR_IMAGE_MAX_DIMENSION,
    AVATAR_IMAGE_MIN_DIMENSION,
    AVATAR_IMAGE_OUTPUT_QUALITY,
    AVATAR_IMAGE_OUTPUT_SIZE,
    AVATAR_IMAGE_UPLOAD_DIR,
} from "../../constants/upload-avatar.constants.js";
import { ensureDir, safeUnlink } from "../../utils/upload/fs.util.js";
import { isMagicNumberCheckEnabled, isMimeCheckEnabled, validateMagicNumberForImage } from "../../utils/upload/upload-validation.util.js";

export class AvatarUploadValidationError extends Error {
    readonly status: number;

    constructor(status: number, message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "AvatarUploadValidationError";
        this.status = status;
    }
}

type StoredAvatarFile = {
    storedFilename: string;
    storedPath: string;
};

function validationError(status: number, message: string, cause?: unknown): AvatarUploadValidationError {
    return new AvatarUploadValidationError(status, message, { cause });
}

// Runs the existing avatar upload pipeline: validation -> sharp transform -> filesystem write.
export async function storeAvatarImageForUser(params: {
    userId: number;
    file: Express.Multer.File;
}): Promise<StoredAvatarFile> {
    const { userId, file } = params;

    if (isMagicNumberCheckEnabled()) {
        try {
            validateMagicNumberForImage(file.buffer);
        } catch (err) {
            throw validationError(422, "Invalid image data.", err);
        }
    }

    if (isMimeCheckEnabled() && !AVATAR_IMAGE_ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw validationError(422, "Unsupported image type.");
    }

    if (file.size > AVATAR_IMAGE_MAX_BYTES) {
        throw validationError(413, "Avatar file is too large.");
    }

    const image = sharp(file.buffer, {
        limitInputPixels: AVATAR_IMAGE_MAX_DIMENSION * AVATAR_IMAGE_MAX_DIMENSION,
    });

    let metadata: Awaited<ReturnType<typeof image.metadata>>;
    try {
        metadata = await image.metadata();
    } catch (err) {
        throw validationError(422, "Invalid image data.", err);
    }

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (!width || !height) {
        throw validationError(422, "Invalid image data.");
    }
    if (width > AVATAR_IMAGE_MAX_DIMENSION || height > AVATAR_IMAGE_MAX_DIMENSION) {
        throw validationError(422, "Image dimensions exceed the limit.");
    }
    if (width < AVATAR_IMAGE_MIN_DIMENSION || height < AVATAR_IMAGE_MIN_DIMENSION) {
        throw validationError(422, "Image dimensions are too small.");
    }

    await ensureDir(AVATAR_IMAGE_UPLOAD_DIR);

    const filename = `user-${userId}-${Date.now()}.webp`;
    const outputPath = path.join(AVATAR_IMAGE_UPLOAD_DIR, filename);

    await image
        .resize(AVATAR_IMAGE_OUTPUT_SIZE, AVATAR_IMAGE_OUTPUT_SIZE, { fit: "cover", position: "centre" })
        .webp({ quality: AVATAR_IMAGE_OUTPUT_QUALITY })
        .toFile(outputPath);

    return {
        storedFilename: filename,
        storedPath: outputPath,
    };
}

// Applies upload pipeline result to profile DB and removes the previous stored avatar (best effort).
export async function uploadProfileImageFromFile(params: {
    userId: number;
    file: Express.Multer.File;
}): Promise<{
    storedFilename: string;
    storedPath: string;
    previousFilename: string | null;
}> {
    const existing = await findUserProfileById(params.userId);
    const stored = await storeAvatarImageForUser(params);
    await updateUserProfileImage({ userId: params.userId, profileImageUrl: stored.storedFilename });

    let previousFilename: string | null = null;
    if (existing?.profileImageUrl) {
        previousFilename = path.basename(existing.profileImageUrl);
        if (previousFilename !== stored.storedFilename) {
            await safeUnlink(path.join(AVATAR_IMAGE_UPLOAD_DIR, previousFilename));
        }
    }

    return {
        storedFilename: stored.storedFilename,
        storedPath: stored.storedPath,
        previousFilename,
    };
}
