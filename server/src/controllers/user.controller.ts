import type { Request, Response, NextFunction } from "express";
import { findUserProfileById, findUserProfileByUsername, updateUserProfile } from "../services/auth.service.ts";
import { isPublicProfileHandle, normalizeUsernameParam } from "../utils/username.util.ts";

function normalizeString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeNullable(value: unknown): string | null {
    const trimmed = normalizeString(value);
    return trimmed ? trimmed : null;
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string): boolean {
    return /^[0-9+\-() ]+$/.test(value);
}

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
                profileImageUrl: profile.profileImageUrl
                    ? profile.profileImageUrl.startsWith("/")
                        ? profile.profileImageUrl
                        : `/uploads/avatars/${profile.profileImageUrl}`
                    : null,
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

export async function getProfileEditForm(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = Number(req.session.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(401).redirect("/login");
        }

        const profile = await findUserProfileById(userId);
        if (!profile) {
            return res.status(404).send("User not found");
        }

        return res.render("settings/profile", {
            formError: null,
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

export async function postProfileEdit(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = Number(req.session.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(401).redirect("/login");
        }

        const profile = await findUserProfileById(userId);
        if (!profile) {
            return res.status(404).send("User not found");
        }

        const displayName = normalizeNullable(req.body?.displayName);
        const email = normalizeNullable(req.body?.email);
        const phoneNumber = normalizeNullable(req.body?.phoneNumber);
        const bio = normalizeNullable(req.body?.bio);

        if (displayName && displayName.length > 50) {
            return res.status(400).render("settings/profile", {
                formError: "Display name must be 50 characters or less.",
                profile: { ...profile, displayName, email, phoneNumber, bio },
            });
        }

        if (email && !isValidEmail(email)) {
            return res.status(400).render("settings/profile", {
                formError: "Email format is invalid.",
                profile: { ...profile, displayName, email, phoneNumber, bio },
            });
        }

        if (phoneNumber && (phoneNumber.length > 30 || !isValidPhone(phoneNumber))) {
            return res.status(400).render("settings/profile", {
                formError: "Phone number format is invalid.",
                profile: { ...profile, displayName, email, phoneNumber, bio },
            });
        }

        if (bio && bio.length > 500) {
            return res.status(400).render("settings/profile", {
                formError: "Bio must be 500 characters or less.",
                profile: { ...profile, displayName, email, phoneNumber, bio },
            });
        }

        const updated = await updateUserProfile({
            userId,
            displayName,
            email,
            phoneNumber,
            bio,
        });

        if (!updated) {
            return res.status(404).send("User not found");
        }

        return res.redirect(`/@${profile.username}`);
    } catch (err) {
        return next(err);
    }
}
