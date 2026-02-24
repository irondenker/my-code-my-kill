import type { Request, Response } from "express";
import {
    completePasswordResetByTokenHash,
    findUserByUsername,
    findValidPasswordResetTokenOwner,
    savePasswordResetToken,
} from "../../services/auth.service.js";
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
import { HttpError } from "../../utils/http/http-error.js";

const FORGOT_PASSWORD_ACCEPTED_MESSAGE =
    "If the submitted account information is valid, the reset request has been accepted.";

function renderForgotPasswordPage(
    res: Response,
    params: {
        formError?: string | null;
        formMessage?: string | null;
        username?: string;
        resetPasswordLink?: string | null;
    } = {}
) {
    return res.render("auth/forgot-password", {
        formError: params.formError ?? null,
        formMessage: params.formMessage ?? null,
        formData: {
            username: params.username ?? "",
        },
        resetPasswordLink: params.resetPasswordLink ?? null,
    });
}

function renderResetPasswordPage(
    res: Response,
    params: {
        formError?: string | null;
        formMessage?: string | null;
        token?: string | null;
    } = {}
) {
    const resetToken = normalizeString(params.token ?? "", "");
    return res.render("auth/reset-password", {
        formError: params.formError ?? null,
        formMessage: params.formMessage ?? null,
        resetAction: `/reset-password?token=${encodeURIComponent(resetToken)}`,
    });
}

export async function getForgotPasswordPage(_req: Request, res: Response) {
    return renderForgotPasswordPage(res);
}

export async function postForgotPassword(req: Request, res: Response) {
    const parsed = parseForgotPasswordForm(req.body ?? {});
    const fallbackUsername = normalizeString(req.body?.username);
    const requestedUsername = parsed.success ? parsed.data.username : fallbackUsername;

    const passwordResetOptions = getSecurityDefenseOptions().passwordReset;
    const ipAddress = getRequestIp(req);
    const userAgent = getRequestUserAgent(req);

    let issued = false;
    let targetUserId: number | null = null;
    let targetUsername: string | null = null;
    let tokenExpiresAt: Date | null = null;
    let resetPasswordLink: string | null = null;

    if (parsed.success) {
        const user = await findUserByUsername(parsed.data.username);
        if (user) {
            targetUserId = user.userId;
            targetUsername = user.username;

            const rawToken = generatePasswordResetToken();
            tokenExpiresAt = new Date(Date.now() + passwordResetOptions.tokenTtlMinutes * 60_000);
            await savePasswordResetToken({
                userId: user.userId,
                tokenHash: hashPasswordResetToken(rawToken),
                expiresAt: tokenExpiresAt,
            });

            issued = true;
            resetPasswordLink = `/reset-password?token=${encodeURIComponent(rawToken)}`;
        }
    }

    await logPasswordResetRequestedSafely({
        targetUserId,
        targetUsername,
        requestedUsername,
        issued,
        tokenExpiresAt,
        ipAddress,
        userAgent,
    });

    return renderForgotPasswordPage(res, {
        formMessage: FORGOT_PASSWORD_ACCEPTED_MESSAGE,
        username: parsed.success ? parsed.data.username : fallbackUsername,
        resetPasswordLink,
    });
}

export async function getResetPasswordPage(req: Request, res: Response) {
    const token = normalizeString(req.query?.token, "");
    if (token.length === 0) {
        throw new HttpError(404, "Not Found");
    }

    const tokenOwner = await findValidPasswordResetTokenOwner(hashPasswordResetToken(token));
    if (!tokenOwner) {
        throw new HttpError(404, "Not Found");
    }

    return renderResetPasswordPage(res, { token });
}

export async function postResetPassword(req: Request, res: Response) {
    const token = normalizeString(req.query?.token, "");
    if (token.length === 0) {
        throw new HttpError(404, "Not Found");
    }

    const parsed = parseResetPasswordForm(req.body ?? {});
    if (!parsed.success) {
        return res.status(400).render("auth/reset-password", {
            formError: "Password and confirmation are required.",
            formMessage: null,
            resetAction: `/reset-password?token=${encodeURIComponent(token)}`,
        });
    }

    const { password, confirmPassword } = parsed.data;
    if (password !== confirmPassword) {
        return res.status(422).render("auth/reset-password", {
            formError: "Password confirmation does not match.",
            formMessage: null,
            resetAction: `/reset-password?token=${encodeURIComponent(token)}`,
        });
    }
    if (!isValidPassword(password)) {
        return res.status(422).render("auth/reset-password", {
            formError: "Password must be between 8 and 128 characters.",
            formMessage: null,
            resetAction: `/reset-password?token=${encodeURIComponent(token)}`,
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
            resetAction: `/reset-password?token=${encodeURIComponent(token)}`,
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
        resetAction: `/reset-password?token=${encodeURIComponent(token)}`,
    });
}
