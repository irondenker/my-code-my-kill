import type { Request, Response } from "express";
import {
    completePasswordResetByTokenHash,
    findUserByUsername,
    findValidPasswordResetTokenOwner,
    savePasswordResetToken,
} from "../../services/auth.service.js";
import { findUserProfileById } from "../../services/profile.service.js";
import {
    logPasswordResetCompletedSafely,
    logPasswordResetRequestedSafely,
} from "../../services/audit.service.js";
import { getSecurityDefenseOptions } from "../../config/security-defense-options.js";
import { parseForgotPasswordForm, parseResetPasswordForm } from "../../schemas/auth.schema.js";
import { hashPassword, isValidPassword } from "../../utils/password.util.js";
import { normalizeString } from "../../utils/string.util.js";
import {
    generatePasswordResetToken,
    hashPasswordResetToken,
} from "../../utils/auth/password-reset-token.util.js";
import { getRequestIp, getRequestUserAgent } from "../../utils/http/request-meta.util.js";

const FORGOT_PASSWORD_ACCEPTED_MESSAGE =
    "If the submitted account information is valid, the reset request has been accepted.";

function normalizeEmailForMatch(value: string): string {
    return value.trim().toLowerCase();
}

function normalizePhoneForMatch(value: string): string {
    return value.replace(/[\s\-()]/g, "");
}

function matchesPseudoVerification(params: {
    storedEmail: string | null;
    storedPhoneNumber: string | null;
    enteredEmail: string | undefined;
    enteredPhoneNumber: string | undefined;
}): boolean | null {
    const hasStoredVerifier = Boolean(params.storedEmail || params.storedPhoneNumber);
    if (!hasStoredVerifier) {
        return null;
    }

    const emailMatched =
        typeof params.storedEmail === "string" &&
        typeof params.enteredEmail === "string" &&
        normalizeEmailForMatch(params.storedEmail) === normalizeEmailForMatch(params.enteredEmail);
    const phoneMatched =
        typeof params.storedPhoneNumber === "string" &&
        typeof params.enteredPhoneNumber === "string" &&
        normalizePhoneForMatch(params.storedPhoneNumber) === normalizePhoneForMatch(params.enteredPhoneNumber);

    return emailMatched || phoneMatched;
}

function renderForgotPasswordPage(
    res: Response,
    params: {
        formError?: string | null;
        formMessage?: string | null;
        username?: string;
        email?: string;
        phoneNumber?: string;
        devResetToken?: string | null;
        devResetLink?: string | null;
    } = {}
) {
    return res.render("auth/forgot-password", {
        formError: params.formError ?? null,
        formMessage: params.formMessage ?? null,
        formData: {
            username: params.username ?? "",
            email: params.email ?? "",
            phoneNumber: params.phoneNumber ?? "",
        },
        devResetToken: params.devResetToken ?? null,
        devResetLink: params.devResetLink ?? null,
    });
}

function renderResetPasswordPage(
    res: Response,
    params: {
        formError?: string | null;
        formMessage?: string | null;
        token?: string;
    } = {}
) {
    return res.render("auth/reset-password", {
        formError: params.formError ?? null,
        formMessage: params.formMessage ?? null,
        formData: {
            token: params.token ?? "",
        },
    });
}

export async function getForgotPasswordPage(_req: Request, res: Response) {
    return renderForgotPasswordPage(res);
}

export async function postForgotPassword(req: Request, res: Response) {
    const parsed = parseForgotPasswordForm(req.body ?? {});
    const fallbackUsername = normalizeString(req.body?.username);
    const fallbackEmail = normalizeString(req.body?.email, "");
    const fallbackPhoneNumber = normalizeString(req.body?.phoneNumber, "");
    const requestedUsername = parsed.success ? parsed.data.username : fallbackUsername;

    const securityDefense = getSecurityDefenseOptions();
    const passwordResetOptions = securityDefense.passwordReset;
    const pseudoVerifyEnabled = passwordResetOptions.enabled && passwordResetOptions.pseudoVerify.enabled;
    const devRevealTokenEnabled = passwordResetOptions.enabled && passwordResetOptions.devRevealToken.enabled;
    const ipAddress = getRequestIp(req);
    const userAgent = getRequestUserAgent(req);

    let issued = false;
    let pseudoVerified: boolean | null = null;
    let targetUserId: number | null = null;
    let targetUsername: string | null = null;
    let tokenExpiresAt: Date | null = null;
    let devResetToken: string | null = null;
    let devResetLink: string | null = null;

    if (passwordResetOptions.enabled && parsed.success) {
        const user = await findUserByUsername(parsed.data.username);
        if (user) {
            let canIssue = true;
            targetUserId = user.userId;
            targetUsername = user.username;

            if (pseudoVerifyEnabled) {
                const profile = await findUserProfileById(user.userId);
                pseudoVerified = matchesPseudoVerification({
                    storedEmail: profile?.email ?? null,
                    storedPhoneNumber: profile?.phoneNumber ?? null,
                    enteredEmail: parsed.data.email,
                    enteredPhoneNumber: parsed.data.phoneNumber,
                });

                if (pseudoVerified === false) {
                    canIssue = false;
                }
            }

            if (canIssue) {
                const rawToken = generatePasswordResetToken();
                tokenExpiresAt = new Date(Date.now() + passwordResetOptions.tokenTtlMinutes * 60_000);
                await savePasswordResetToken({
                    userId: user.userId,
                    tokenHash: hashPasswordResetToken(rawToken),
                    expiresAt: tokenExpiresAt,
                });

                issued = true;
                if (devRevealTokenEnabled) {
                    devResetToken = rawToken;
                    devResetLink = `/reset-password?token=${encodeURIComponent(rawToken)}`;
                }
            }
        }
    }

    await logPasswordResetRequestedSafely({
        targetUserId,
        targetUsername,
        requestedUsername,
        issued,
        pseudoVerifyEnabled,
        pseudoVerified,
        tokenExpiresAt,
        devResetToken,
        ipAddress,
        userAgent,
    });

    return renderForgotPasswordPage(res, {
        formMessage: FORGOT_PASSWORD_ACCEPTED_MESSAGE,
        username: parsed.success ? parsed.data.username : fallbackUsername,
        email: parsed.success ? parsed.data.email ?? "" : fallbackEmail,
        phoneNumber: parsed.success ? parsed.data.phoneNumber ?? "" : fallbackPhoneNumber,
        devResetToken,
        devResetLink,
    });
}

export async function getResetPasswordPage(req: Request, res: Response) {
    const securityDefense = getSecurityDefenseOptions();
    if (!securityDefense.passwordReset.enabled) {
        return res.status(404).render("auth/reset-password", {
            formError: "Password reset is currently unavailable.",
            formMessage: null,
            formData: {
                token: "",
            },
        });
    }

    const token = normalizeString(req.query?.token, "");
    if (token.length === 0) {
        return renderResetPasswordPage(res);
    }

    const tokenOwner = await findValidPasswordResetTokenOwner(hashPasswordResetToken(token));
    if (!tokenOwner) {
        return res.status(400).render("auth/reset-password", {
            formError: "Reset token is invalid or expired.",
            formMessage: null,
            formData: {
                token: "",
            },
        });
    }

    return renderResetPasswordPage(res, { token });
}

export async function postResetPassword(req: Request, res: Response) {
    const securityDefense = getSecurityDefenseOptions();
    if (!securityDefense.passwordReset.enabled) {
        return res.status(404).render("auth/reset-password", {
            formError: "Password reset is currently unavailable.",
            formMessage: null,
            formData: {
                token: "",
            },
        });
    }

    const parsed = parseResetPasswordForm(req.body ?? {});
    const fallbackToken = normalizeString(req.body?.token, "");
    if (!parsed.success) {
        return res.status(400).render("auth/reset-password", {
            formError: "Reset token and password are required.",
            formMessage: null,
            formData: {
                token: fallbackToken,
            },
        });
    }

    const { token, password, confirmPassword } = parsed.data;
    if (password !== confirmPassword) {
        return res.status(422).render("auth/reset-password", {
            formError: "Password confirmation does not match.",
            formMessage: null,
            formData: {
                token,
            },
        });
    }
    if (!isValidPassword(password)) {
        return res.status(422).render("auth/reset-password", {
            formError: "Password must be between 8 and 128 characters.",
            formMessage: null,
            formData: {
                token,
            },
        });
    }

    const completed = await completePasswordResetByTokenHash({
        tokenHash: hashPasswordResetToken(token),
        passwordHash: hashPassword(password),
    });

    if (!completed) {
        return res.status(400).render("auth/reset-password", {
            formError: "Reset token is invalid or expired.",
            formMessage: null,
            formData: {
                token: "",
            },
        });
    }

    await logPasswordResetCompletedSafely({
        targetUserId: completed.userId,
        targetUsername: completed.username,
        result: "success",
        ipAddress: getRequestIp(req),
        userAgent: getRequestUserAgent(req),
    });

    return res.render("auth/reset-password", {
        formError: null,
        formMessage: "Password reset completed. You can sign in with the new password.",
        formData: {
            token: "",
        },
    });
}
