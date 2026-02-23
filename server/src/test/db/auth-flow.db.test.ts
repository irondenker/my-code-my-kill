import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import { createUserForRegister, findUserByUsername } from "../../services/auth.service.js";
import { findUserProfileById, updateUserProfile } from "../../services/profile.service.js";
import { hashPassword } from "../../utils/password.util.js";
import {
    cleanupUserById,
    cleanupUserByUsername,
    makeId,
    runDbTests,
    setUserActive,
    skipReason,
} from "../helpers/db-test.helpers.js";
import {
    fetchFormPage,
    loginAs,
    withTestServer,
} from "../helpers/http-test.helpers.js";

type LoginDefenseState = {
    loginFailedCount: number;
    loginLockedUntil: Date | null;
    passwordResetRequired: boolean;
};

type PasswordResetState = {
    loginFailedCount: number;
    loginLockedUntil: Date | null;
    passwordResetRequired: boolean;
    passwordResetTokenHash: string | null;
    passwordResetTokenExpiresAt: Date | null;
    passwordResetRequestedAt: Date | null;
    passwordResetUsedAt: Date | null;
};

async function findLoginDefenseStateByUserId(userId: number): Promise<LoginDefenseState | null> {
    const rows = await sequelize.query<{
        login_failed_count: number;
        login_locked_until: Date | null;
        password_reset_required: boolean;
    }>(
        `
        SELECT
            login_failed_count,
            login_locked_until,
            password_reset_required
        FROM users
        WHERE user_id = :userId
        LIMIT 1
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { userId },
        }
    );

    const row = rows[0];
    if (!row) {
        return null;
    }

    return {
        loginFailedCount: Number(row.login_failed_count),
        loginLockedUntil: row.login_locked_until ? new Date(row.login_locked_until) : null,
        passwordResetRequired: Boolean(row.password_reset_required),
    };
}

async function findPasswordResetStateByUserId(userId: number): Promise<PasswordResetState | null> {
    const rows = await sequelize.query<{
        login_failed_count: number;
        login_locked_until: Date | null;
        password_reset_required: boolean;
        password_reset_token_hash: string | null;
        password_reset_token_expires_at: Date | null;
        password_reset_requested_at: Date | null;
        password_reset_used_at: Date | null;
    }>(
        `
        SELECT
            login_failed_count,
            login_locked_until,
            password_reset_required,
            password_reset_token_hash,
            password_reset_token_expires_at,
            password_reset_requested_at,
            password_reset_used_at
        FROM users
        WHERE user_id = :userId
        LIMIT 1
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { userId },
        }
    );

    const row = rows[0];
    if (!row) {
        return null;
    }

    return {
        loginFailedCount: Number(row.login_failed_count),
        loginLockedUntil: row.login_locked_until ? new Date(row.login_locked_until) : null,
        passwordResetRequired: Boolean(row.password_reset_required),
        passwordResetTokenHash: row.password_reset_token_hash ?? null,
        passwordResetTokenExpiresAt: row.password_reset_token_expires_at
            ? new Date(row.password_reset_token_expires_at)
            : null,
        passwordResetRequestedAt: row.password_reset_requested_at ? new Date(row.password_reset_requested_at) : null,
        passwordResetUsedAt: row.password_reset_used_at ? new Date(row.password_reset_used_at) : null,
    };
}

async function withAccountLockoutEnabled(run: () => Promise<void>): Promise<void> {
    const keys = [
        "SECURITY_DEFENSE_ENABLED",
        "SECURITY_DEFENSE_ACCOUNT_LOCKOUT_ENABLED",
        "SECURITY_DEFENSE_ACCOUNT_LOCKOUT_MAX_FAILURES",
        "SECURITY_DEFENSE_ACCOUNT_LOCKOUT_LOCK_MINUTES",
        "SECURITY_DEFENSE_ACCOUNT_LOCKOUT_USE_LOGIN_LOCK_UNTIL",
    ] as const;

    const previous = new Map<string, string | undefined>();
    for (const key of keys) {
        previous.set(key, process.env[key]);
    }

    process.env.SECURITY_DEFENSE_ENABLED = "true";
    process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_ENABLED = "true";
    process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_MAX_FAILURES = "5";
    process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_LOCK_MINUTES = "10";
    process.env.SECURITY_DEFENSE_ACCOUNT_LOCKOUT_USE_LOGIN_LOCK_UNTIL = "true";

    try {
        await run();
    } finally {
        for (const key of keys) {
            const value = previous.get(key);
            if (typeof value === "undefined") {
                delete process.env[key];
                continue;
            }
            process.env[key] = value;
        }
    }
}

async function withPasswordResetEnabled(
    params: {
        devRevealTokenEnabled?: boolean;
        pseudoVerifyEnabled?: boolean;
    },
    run: () => Promise<void>
): Promise<void> {
    const keys = [
        "SECURITY_DEFENSE_ENABLED",
        "SECURITY_DEFENSE_PASSWORD_RESET_ENABLED",
        "SECURITY_DEFENSE_PASSWORD_RESET_TOKEN_TTL_MINUTES",
        "SECURITY_DEFENSE_PASSWORD_RESET_DEV_REVEAL_TOKEN_ENABLED",
        "SECURITY_DEFENSE_PASSWORD_RESET_PSEUDO_VERIFY_ENABLED",
    ] as const;

    const previous = new Map<string, string | undefined>();
    for (const key of keys) {
        previous.set(key, process.env[key]);
    }

    process.env.SECURITY_DEFENSE_ENABLED = "true";
    process.env.SECURITY_DEFENSE_PASSWORD_RESET_ENABLED = "true";
    process.env.SECURITY_DEFENSE_PASSWORD_RESET_TOKEN_TTL_MINUTES = "20";
    process.env.SECURITY_DEFENSE_PASSWORD_RESET_DEV_REVEAL_TOKEN_ENABLED = params.devRevealTokenEnabled ? "true" : "false";
    process.env.SECURITY_DEFENSE_PASSWORD_RESET_PSEUDO_VERIFY_ENABLED = params.pseudoVerifyEnabled ? "true" : "false";

    try {
        await run();
    } finally {
        for (const key of keys) {
            const value = previous.get(key);
            if (typeof value === "undefined") {
                delete process.env[key];
                continue;
            }
            process.env[key] = value;
        }
    }
}

async function postLoginForm(params: {
    baseUrl: string;
    username: string;
    password: string;
    nextPath?: string;
}): Promise<{ response: Response; body: string }> {
    const nextPath = params.nextPath ?? "/board";
    const encodedNext = encodeURIComponent(nextPath);
    const loginPage = await fetchFormPage({
        baseUrl: params.baseUrl,
        path: `/login?next=${encodedNext}`,
    });

    const response = await fetch(`${params.baseUrl}/login`, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: loginPage.cookie,
        },
        body:
            `_csrf=${encodeURIComponent(loginPage.csrfToken)}` +
            `&username=${encodeURIComponent(params.username)}` +
            `&password=${encodeURIComponent(params.password)}` +
            `&next=${encodedNext}`,
        redirect: "manual",
    });

    const body = await response.text();
    return { response, body };
}

async function postForgotPasswordForm(params: {
    baseUrl: string;
    username: string;
    email?: string;
    phoneNumber?: string;
}): Promise<{ response: Response; body: string }> {
    const forgotPage = await fetchFormPage({
        baseUrl: params.baseUrl,
        path: "/forgot-password",
    });

    const response = await fetch(`${params.baseUrl}/forgot-password`, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: forgotPage.cookie,
        },
        body:
            `_csrf=${encodeURIComponent(forgotPage.csrfToken)}` +
            `&username=${encodeURIComponent(params.username)}` +
            `&email=${encodeURIComponent(params.email ?? "")}` +
            `&phoneNumber=${encodeURIComponent(params.phoneNumber ?? "")}`,
        redirect: "manual",
    });

    const body = await response.text();
    return { response, body };
}

async function postResetPasswordForm(params: {
    baseUrl: string;
    token: string;
    password: string;
    confirmPassword?: string;
}): Promise<{ response: Response; body: string }> {
    const resetPage = await fetchFormPage({
        baseUrl: params.baseUrl,
        path: `/reset-password?token=${encodeURIComponent(params.token)}`,
    });

    const response = await fetch(`${params.baseUrl}/reset-password`, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie: resetPage.cookie,
        },
        body:
            `_csrf=${encodeURIComponent(resetPage.csrfToken)}` +
            `&token=${encodeURIComponent(params.token)}` +
            `&password=${encodeURIComponent(params.password)}` +
            `&confirmPassword=${encodeURIComponent(params.confirmPassword ?? params.password)}`,
        redirect: "manual",
    });

    const body = await response.text();
    return { response, body };
}

function extractDevResetToken(html: string): string | null {
    const match = html.match(/Token:\s*<code>([^<]+)<\/code>/);
    return match?.[1] ?? null;
}

if (runDbTests) {
    before(async () => {
        await sequelize.authenticate();
    });

    after(async () => {
        await sequelize.close();
    });
}

test("auth/profile services persist and read back user data", { skip: skipReason }, async () => {
    const username = makeId("dbuser").slice(0, 32);
    const passwordHash = hashPassword("db-test-password");
    let createdUserId: number | null = null;

    try {
        const created = await createUserForRegister({ username, passwordHash });
        createdUserId = created.userId;
        assert.equal(created.username, username);
        assert.equal(created.userRole, "user");
        assert.equal(created.isActive, true);

        const found = await findUserByUsername(username);
        assert.notEqual(found, null);
        assert.equal(found?.userId, created.userId);
        assert.equal(found?.passwordHash, passwordHash);

        const updated = await updateUserProfile({
            userId: created.userId,
            displayName: "DB Test User",
            email: "db-test@example.com",
            phoneNumber: "010-9999-1234",
            bio: "profile-updated",
        });
        assert.equal(updated, true);

        const profile = await findUserProfileById(created.userId);
        assert.notEqual(profile, null);
        assert.equal(profile?.displayName, "DB Test User");
        assert.equal(profile?.email, "db-test@example.com");
        assert.equal(profile?.bio, "profile-updated");
    } finally {
        if (createdUserId !== null) {
            await cleanupUserById(createdUserId);
        } else {
            await cleanupUserByUsername(username);
        }
    }
});

test("auth endpoints register successfully with valid csrf/session and persist user", { skip: skipReason }, async () => {
    const username = makeId("webreg").slice(0, 32);
    let userId: number | null = null;

    try {
        await withTestServer(async (baseUrl) => {
            const password = "register-pass-123";
            const { csrfToken, cookie } = await fetchFormPage({ baseUrl, path: "/register" });

            const response = await fetch(`${baseUrl}/register`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie,
                },
                body: `_csrf=${encodeURIComponent(csrfToken)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
                redirect: "manual",
            });

            assert.equal(response.status, 302);
            assert.equal(response.headers.get("location"), "/board");

            const created = await findUserByUsername(username);
            assert.notEqual(created, null);
            assert.equal(created?.isActive, true);
            assert.equal(created?.userRole, "user");
            userId = created?.userId ?? null;

            const nextCookie = (response.headers.get("set-cookie")?.match(/mcmk\.sid=[^;]+/)?.[0]) ?? cookie;
            const boardResponse = await fetch(`${baseUrl}/board`, {
                headers: { cookie: nextCookie },
            });
            assert.equal(boardResponse.status, 200);
        });
    } finally {
        if (userId !== null) {
            await cleanupUserById(userId);
        } else {
            await cleanupUserByUsername(username);
        }
    }
});

test("auth endpoints login successfully and honor safe next redirect", { skip: skipReason }, async () => {
    const username = makeId("weblogin").slice(0, 32);
    const password = "login-pass-123";
    const created = await createUserForRegister({
        username,
        passwordHash: hashPassword(password),
    });

    try {
        await withTestServer(async (baseUrl) => {
            const authCookie = await loginAs({
                baseUrl,
                username,
                password,
                nextPath: "/board",
            });

            const boardResponse = await fetch(`${baseUrl}/board`, {
                headers: { cookie: authCookie },
            });
            assert.equal(boardResponse.status, 200);
        });
    } finally {
        await cleanupUserById(created.userId);
    }
});

test("auth endpoints reject duplicate username on register", { skip: skipReason }, async () => {
    const username = makeId("dupuser").slice(0, 32);
    const existing = await createUserForRegister({
        username,
        passwordHash: hashPassword("register-pass-123"),
    });

    try {
        await withTestServer(async (baseUrl) => {
            const { csrfToken, cookie } = await fetchFormPage({ baseUrl, path: "/register" });
            const response = await fetch(`${baseUrl}/register`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie,
                },
                body: `_csrf=${encodeURIComponent(csrfToken)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent("another-pass-123")}`,
                redirect: "manual",
            });
            const body = await response.text();

            assert.equal(response.status, 409);
            assert.match(body, /Username is already taken\./);
        });
    } finally {
        await cleanupUserById(existing.userId);
    }
});

test("auth endpoints reject invalid credentials on login", { skip: skipReason }, async () => {
    const username = makeId("badlogin").slice(0, 32);
    const password = "good-pass-123";
    const existing = await createUserForRegister({
        username,
        passwordHash: hashPassword(password),
    });

    try {
        await withTestServer(async (baseUrl) => {
            const { csrfToken, cookie } = await fetchFormPage({
                baseUrl,
                path: "/login?next=%2Fboard",
            });
            const response = await fetch(`${baseUrl}/login`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie,
                },
                body: `_csrf=${encodeURIComponent(csrfToken)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent("wrong-pass-123")}&next=%2Fboard`,
                redirect: "manual",
            });
            const body = await response.text();

            assert.equal(response.status, 401);
            assert.match(body, /Invalid username or password\./);
            assert.match(body, /name="next" value="\/board"/);
        });
    } finally {
        await cleanupUserById(existing.userId);
    }
});

test("auth endpoints block inactive accounts on login", { skip: skipReason }, async () => {
    const username = makeId("inactive").slice(0, 32);
    const password = "inactive-pass-123";
    const existing = await createUserForRegister({
        username,
        passwordHash: hashPassword(password),
    });
    await setUserActive(existing.userId, false);

    try {
        await withTestServer(async (baseUrl) => {
            const { csrfToken, cookie } = await fetchFormPage({ baseUrl, path: "/login" });
            const response = await fetch(`${baseUrl}/login`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie,
                },
                body: `_csrf=${encodeURIComponent(csrfToken)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
                redirect: "manual",
            });
            const body = await response.text();

            assert.equal(response.status, 403);
            assert.match(body, /This account is inactive/);
        });
    } finally {
        await cleanupUserById(existing.userId);
    }
});

test("auth endpoints fallback to /board for unsafe next on login success", { skip: skipReason }, async () => {
    const username = makeId("unsafe-next").slice(0, 32);
    const password = "unsafe-pass-123";
    const existing = await createUserForRegister({
        username,
        passwordHash: hashPassword(password),
    });

    try {
        await withTestServer(async (baseUrl) => {
            const { csrfToken, cookie } = await fetchFormPage({ baseUrl, path: "/login" });
            const response = await fetch(`${baseUrl}/login`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie,
                },
                body: `_csrf=${encodeURIComponent(csrfToken)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&next=${encodeURIComponent("https://evil.example/path")}`,
                redirect: "manual",
            });

            assert.equal(response.status, 302);
            assert.equal(response.headers.get("location"), "/board");
        });
    } finally {
        await cleanupUserById(existing.userId);
    }
});

test("auth endpoints logout clears session and redirects to root", { skip: skipReason }, async () => {
    const username = makeId("logout-user").slice(0, 32);
    const password = "logout-pass-123";
    const existing = await createUserForRegister({
        username,
        passwordHash: hashPassword(password),
    });

    try {
        await withTestServer(async (baseUrl) => {
            const authCookie = await loginAs({
                baseUrl,
                username,
                password,
                nextPath: "/settings/profile",
            });

            const profilePage = await fetchFormPage({
                baseUrl,
                path: "/settings/profile",
                cookie: authCookie,
            });

            const logoutResponse = await fetch(`${baseUrl}/logout`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: profilePage.cookie,
                },
                body: `_csrf=${encodeURIComponent(profilePage.csrfToken)}`,
                redirect: "manual",
            });

            assert.equal(logoutResponse.status, 302);
            assert.equal(logoutResponse.headers.get("location"), "/");

            const setCookie = logoutResponse.headers.get("set-cookie") ?? "";
            assert.match(setCookie, /mcmk\.sid=/);

            const protectedAfterLogout = await fetch(`${baseUrl}/settings/profile`, {
                headers: {
                    cookie: profilePage.cookie,
                },
                redirect: "manual",
            });
            assert.equal(protectedAfterLogout.status, 302);
            assert.match(protectedAfterLogout.headers.get("location") ?? "", /^\/login/);
        });
    } finally {
        await cleanupUserById(existing.userId);
    }
});

test("auth defense resets failed counter after successful login when enabled", { skip: skipReason }, async () => {
    const username = makeId("defense-reset").slice(0, 32);
    const password = "defense-pass-123";
    const created = await createUserForRegister({
        username,
        passwordHash: hashPassword(password),
    });

    try {
        await withAccountLockoutEnabled(async () => {
            await withTestServer(async (baseUrl) => {
                for (let i = 0; i < 2; i += 1) {
                    const failedLogin = await postLoginForm({
                        baseUrl,
                        username,
                        password: "wrong-pass-123",
                    });
                    assert.equal(failedLogin.response.status, 401);
                }

                const afterFailures = await findLoginDefenseStateByUserId(created.userId);
                assert.notEqual(afterFailures, null);
                assert.equal(afterFailures?.loginFailedCount, 2);
                assert.equal(afterFailures?.passwordResetRequired, false);

                const authCookie = await loginAs({
                    baseUrl,
                    username,
                    password,
                    nextPath: "/board",
                });
                assert.match(authCookie, /mcmk\.sid=/);

                const afterSuccess = await findLoginDefenseStateByUserId(created.userId);
                assert.notEqual(afterSuccess, null);
                assert.equal(afterSuccess?.loginFailedCount, 0);
                assert.equal(afterSuccess?.passwordResetRequired, false);
                assert.equal(afterSuccess?.loginLockedUntil, null);
            });
        });
    } finally {
        await cleanupUserById(created.userId);
    }
});

test("auth defense enforces password reset after five failed logins", { skip: skipReason }, async () => {
    const username = makeId("defense-lock").slice(0, 32);
    const password = "defense-pass-123";
    const created = await createUserForRegister({
        username,
        passwordHash: hashPassword(password),
    });

    try {
        await withAccountLockoutEnabled(async () => {
            await withTestServer(async (baseUrl) => {
                for (let i = 0; i < 5; i += 1) {
                    const failedLogin = await postLoginForm({
                        baseUrl,
                        username,
                        password: "wrong-pass-123",
                    });
                    assert.equal(failedLogin.response.status, 401);
                    assert.match(failedLogin.body, /Invalid username or password\./);
                }

                const afterFiveFailures = await findLoginDefenseStateByUserId(created.userId);
                assert.notEqual(afterFiveFailures, null);
                assert.equal(afterFiveFailures?.loginFailedCount, 5);
                assert.equal(afterFiveFailures?.passwordResetRequired, true);

                const blockedLogin = await postLoginForm({
                    baseUrl,
                    username,
                    password,
                });
                assert.equal(blockedLogin.response.status, 401);
                assert.match(blockedLogin.body, /Invalid username or password\./);

                const afterBlockedLogin = await findLoginDefenseStateByUserId(created.userId);
                assert.notEqual(afterBlockedLogin, null);
                assert.equal(afterBlockedLogin?.passwordResetRequired, true);
            });
        });
    } finally {
        await cleanupUserById(created.userId);
    }
});

test("forgot/reset flow clears reset-required state and updates password", { skip: skipReason }, async () => {
    const username = makeId("reset-user").slice(0, 32);
    const oldPassword = "old-pass-123";
    const newPassword = "new-pass-123";
    const created = await createUserForRegister({
        username,
        passwordHash: hashPassword(oldPassword),
    });

    try {
        await withAccountLockoutEnabled(async () => {
            await withPasswordResetEnabled(
                {
                    devRevealTokenEnabled: true,
                    pseudoVerifyEnabled: false,
                },
                async () => {
                    await withTestServer(async (baseUrl) => {
                        for (let i = 0; i < 5; i += 1) {
                            const failedLogin = await postLoginForm({
                                baseUrl,
                                username,
                                password: "wrong-pass-123",
                            });
                            assert.equal(failedLogin.response.status, 401);
                        }

                        const beforeReset = await findPasswordResetStateByUserId(created.userId);
                        assert.notEqual(beforeReset, null);
                        assert.equal(beforeReset?.passwordResetRequired, true);

                        const forgotResponse = await postForgotPasswordForm({
                            baseUrl,
                            username,
                        });
                        assert.equal(forgotResponse.response.status, 200);
                        assert.match(
                            forgotResponse.body,
                            /If the submitted account information is valid, the reset request has been accepted\./
                        );

                        const resetToken = extractDevResetToken(forgotResponse.body);
                        assert.notEqual(resetToken, null);

                        const resetResponse = await postResetPasswordForm({
                            baseUrl,
                            token: resetToken ?? "",
                            password: newPassword,
                        });
                        assert.equal(resetResponse.response.status, 200);
                        assert.match(resetResponse.body, /Password reset completed\./);

                        const afterReset = await findPasswordResetStateByUserId(created.userId);
                        assert.notEqual(afterReset, null);
                        assert.equal(afterReset?.passwordResetRequired, false);
                        assert.equal(afterReset?.loginFailedCount, 0);
                        assert.equal(afterReset?.loginLockedUntil, null);
                        assert.equal(afterReset?.passwordResetTokenHash, null);
                        assert.equal(afterReset?.passwordResetTokenExpiresAt, null);
                        assert.notEqual(afterReset?.passwordResetRequestedAt, null);
                        assert.notEqual(afterReset?.passwordResetUsedAt, null);

                        const authCookie = await loginAs({
                            baseUrl,
                            username,
                            password: newPassword,
                            nextPath: "/board",
                        });
                        assert.match(authCookie, /mcmk\.sid=/);
                    });
                }
            );
        });
    } finally {
        await cleanupUserById(created.userId);
    }
});

test("forgot-password keeps generic response and honors pseudo verification", { skip: skipReason }, async () => {
    const username = makeId("pseudo-reset").slice(0, 32);
    const created = await createUserForRegister({
        username,
        passwordHash: hashPassword("pseudo-pass-123"),
    });

    try {
        await updateUserProfile({
            userId: created.userId,
            displayName: null,
            email: "pseudo-user@example.com",
            phoneNumber: "010-4444-5555",
            bio: null,
        });

        await withPasswordResetEnabled(
            {
                devRevealTokenEnabled: true,
                pseudoVerifyEnabled: true,
            },
            async () => {
                await withTestServer(async (baseUrl) => {
                    const mismatched = await postForgotPasswordForm({
                        baseUrl,
                        username,
                        email: "wrong@example.com",
                    });
                    assert.equal(mismatched.response.status, 200);
                    assert.match(
                        mismatched.body,
                        /If the submitted account information is valid, the reset request has been accepted\./
                    );
                    assert.equal(extractDevResetToken(mismatched.body), null);

                    const matched = await postForgotPasswordForm({
                        baseUrl,
                        username,
                        email: "pseudo-user@example.com",
                    });
                    assert.equal(matched.response.status, 200);
                    assert.match(
                        matched.body,
                        /If the submitted account information is valid, the reset request has been accepted\./
                    );
                    assert.notEqual(extractDevResetToken(matched.body), null);
                });
            }
        );
    } finally {
        await cleanupUserById(created.userId);
    }
});
