import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import { findUserProfileById, updateUserProfileImage } from '../services/profile.service.js';
import { AVATAR_IMAGE_UPLOAD_DIR } from '../constants/upload-avatar.constants.js';
import { HttpError } from '../utils/http/http-error.js';
import { safeUnlink } from '../utils/upload/fs.util.js';
import {
  AvatarUploadValidationError,
  uploadProfileImageFromFile,
} from '../services/profile/profile-avatar-upload.service.js';

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
      return next(new HttpError(401, 'Unauthorized'));
    }

    const profile = await findUserProfileById(userId);
    if (!profile) {
      return next(new HttpError(404, 'User not found'));
    }

    return res.status(status).render('settings/profile', {
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

export async function postAvatarUpload(req: Request, res: Response, next: NextFunction) {
  const userId = Number(req.session.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new HttpError(401, 'Unauthorized');
  }

  const file = req.file;
  if (!file) {
    return renderAvatarError(req, res, next, 400, 'Avatar file is required.');
  }

  try {
    const stored = await uploadProfileImageFromFile({ userId, file });
    req.session.profileImageUrl = stored.storedFilename;
  } catch (err) {
    if (err instanceof AvatarUploadValidationError) {
      return renderAvatarError(req, res, next, err.status, err.message);
    }
    throw err;
  }

  const redirectTarget = req.get('referer') ?? `/@${req.session.username ?? ''}`;
  return res.redirect(redirectTarget);
}

export async function postAvatarDelete(req: Request, res: Response) {
  const userId = Number(req.session.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new HttpError(401, 'Unauthorized');
  }

  const profile = await findUserProfileById(userId);
  await updateUserProfileImage({ userId, profileImageUrl: null });
  req.session.profileImageUrl = null;

  if (profile?.profileImageUrl) {
    const previousName = path.basename(profile.profileImageUrl);
    const previousPath = path.join(AVATAR_IMAGE_UPLOAD_DIR, previousName);
    await safeUnlink(previousPath);
  }

  const redirectTarget = req.get('referer') ?? `/@${req.session.username ?? ''}`;
  return res.redirect(redirectTarget);
}
