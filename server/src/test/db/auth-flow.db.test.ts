import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
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
