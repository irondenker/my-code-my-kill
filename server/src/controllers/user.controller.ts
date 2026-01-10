import type { Request, Response, NextFunction } from "express";
import { findUserProfileByUsername } from "../services/auth.service.ts";
import { isPublicProfileHandle, normalizeUsernameParam } from "../utils/username.util.ts";

export async function getUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
        const username = normalizeUsernameParam(req.params.username);
        if (!isPublicProfileHandle(username)) {
            return res.status(400).send("Invalid username");
        }

        const profile = await findUserProfileByUsername(username);
        if (!profile) {
            return res.status(404).send("User not found");
        }

        const viewerUserId = Number(req.session.userId);
        const isOwner = Number.isFinite(viewerUserId) && viewerUserId === profile.userId;
        const isAdmin = req.session.userRole === "admin";
        const canViewPrivate = isOwner || isAdmin;

        return res.render("users/show", {
            profile: {
                username: profile.username,
                displayName: profile.displayName,
                bio: profile.bio,
            },
            privateProfile: canViewPrivate
                ? {
                      email: profile.email,
                      phoneNumber: profile.phoneNumber,
                  }
                : null,
            showOwnerActions: isOwner,
            showAdminNotice: isAdmin && !isOwner,
        });
    } catch (err) {
        return next(err);
    }
}
