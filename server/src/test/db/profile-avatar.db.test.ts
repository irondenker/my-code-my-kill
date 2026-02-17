import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import "dotenv/config";
import sharp from "sharp";
import { sequelize } from "../../db/index.js";
import { createUserForRegister } from "../../services/auth.service.js";
import { findUserProfileById, updateUserProfile } from "../../services/profile.service.js";
import { AVATAR_IMAGE_UPLOAD_DIR } from "../../constants/upload-avatar.constants.js";
import { hashPassword } from "../../utils/password.util.js";
import {
    cleanupUserById,
    cleanupUserByUsername,
    makeId,
    runDbTests,
    setUserRole,
    skipReason,
} from "../helpers/db-test.helpers.js";
import {
    fetchFormPage,
    loginAs,
    withTestServer,
} from "../helpers/http-test.helpers.js";

function makeProfileEditBody(params: {
    csrfToken: string;
    displayName?: string;
    email?: string;
    phoneNumber?: string;
    bio?: string;
}): string {
    return `_csrf=${encodeURIComponent(params.csrfToken)}&displayName=${encodeURIComponent(params.displayName ?? "")}&email=${encodeURIComponent(params.email ?? "")}&phoneNumber=${encodeURIComponent(params.phoneNumber ?? "")}&bio=${encodeURIComponent(params.bio ?? "")}`;
}

if (runDbTests) {
    before(async () => {
        await sequelize.authenticate();
    });

    after(async () => {
        await sequelize.close();
    });
}

test("avatar controller rejects unsupported mime and supports upload/delete flow", { skip: skipReason }, async () => {
    const username = makeId("avatarp1").slice(0, 32);
    const password = "avatar-pass-123";
    let userId: number | null = null;
    let uploadedPath: string | null = null;

    try {
        const created = await createUserForRegister({
            username,
            passwordHash: hashPassword(password),
        });
        userId = created.userId;

        await withTestServer(async (baseUrl) => {
            const authCookie = await loginAs({ baseUrl, username, password, nextPath: "/settings/profile" });
            const settingsPage = await fetchFormPage({
                baseUrl,
                path: "/settings/profile",
                cookie: authCookie,
            });

            const pngBuffer = await sharp({
                create: {
                    width: 128,
                    height: 128,
                    channels: 3,
                    background: { r: 255, g: 0, b: 0 },
                },
            })
                .png()
                .toBuffer();
            const pngBytes = Uint8Array.from(pngBuffer);

            const invalidMimeForm = new FormData();
            invalidMimeForm.set("_csrf", settingsPage.csrfToken);
            invalidMimeForm.set("avatar", new Blob([pngBytes], { type: "text/plain" }), "avatar.png");

            const invalidMimeResponse = await fetch(`${baseUrl}/users/avatar`, {
                method: "POST",
                headers: {
                    cookie: settingsPage.cookie,
                },
                body: invalidMimeForm,
                redirect: "manual",
            });
            const invalidMimeBody = await invalidMimeResponse.text();
            assert.equal(invalidMimeResponse.status, 422);
            assert.match(invalidMimeBody, /Unsupported image type\./);

            const validForm = new FormData();
            validForm.set("_csrf", settingsPage.csrfToken);
            validForm.set("avatar", new Blob([pngBytes], { type: "image/png" }), "avatar.png");

            const uploadResponse = await fetch(`${baseUrl}/users/avatar`, {
                method: "POST",
                headers: {
                    cookie: settingsPage.cookie,
                },
                body: validForm,
                redirect: "manual",
            });
            assert.equal(uploadResponse.status, 302);
            assert.equal(uploadResponse.headers.get("location"), `/@${username}`);

            const profileAfterUpload = await findUserProfileById(created.userId);
            assert.notEqual(profileAfterUpload?.profileImageUrl, null);
            const uploadedName = profileAfterUpload?.profileImageUrl ?? null;
            assert.equal(typeof uploadedName === "string", true);

            uploadedPath = uploadedName ? path.join(AVATAR_IMAGE_UPLOAD_DIR, path.basename(uploadedName)) : null;
            if (!uploadedPath) {
                throw new Error("Uploaded path is missing");
            }
            await fs.access(uploadedPath);

            const deletePage = await fetchFormPage({
                baseUrl,
                path: "/settings/profile",
                cookie: settingsPage.cookie,
            });
            const deleteResponse = await fetch(`${baseUrl}/users/avatar/delete`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: deletePage.cookie,
                },
                body: `_csrf=${encodeURIComponent(deletePage.csrfToken)}`,
                redirect: "manual",
            });
            assert.equal(deleteResponse.status, 302);
            assert.equal(deleteResponse.headers.get("location"), `/@${username}`);

            const profileAfterDelete = await findUserProfileById(created.userId);
            assert.equal(profileAfterDelete?.profileImageUrl, null);

            await assert.rejects(async () => fs.access(uploadedPath as string));
            uploadedPath = null;
        });
    } finally {
        if (uploadedPath) {
            await fs.unlink(uploadedPath).catch(() => undefined);
        }

        if (userId !== null) {
            await cleanupUserById(userId);
        } else {
            await cleanupUserByUsername(username);
        }
    }
});

test("user profile page exposes private fields only to owner or admin", { skip: skipReason }, async () => {
    const ownerUsername = makeId("ownerp1").slice(0, 32);
    const ownerPassword = "owner-pass-123";
    const adminUsername = makeId("adminview").slice(0, 32);
    const adminPassword = "admin-view-pass-123";
    let ownerUserId: number | null = null;
    let adminUserId: number | null = null;

    try {
        const owner = await createUserForRegister({
            username: ownerUsername,
            passwordHash: hashPassword(ownerPassword),
        });
        ownerUserId = owner.userId;
        await updateUserProfile({
            userId: owner.userId,
            displayName: "Owner P1",
            email: "owner-p1@example.com",
            phoneNumber: "010-1234-5678",
            bio: "private-profile-test",
        });

        const admin = await createUserForRegister({
            username: adminUsername,
            passwordHash: hashPassword(adminPassword),
        });
        adminUserId = admin.userId;
        await setUserRole(admin.userId, "admin");

        await withTestServer(async (baseUrl) => {
            const anonymousResponse = await fetch(`${baseUrl}/@${ownerUsername}`);
            const anonymousBody = await anonymousResponse.text();
            assert.equal(anonymousResponse.status, 200);
            assert.equal(anonymousBody.includes("owner-p1@example.com"), false);
            assert.equal(anonymousBody.includes("010-1234-5678"), false);

            const ownerCookie = await loginAs({ baseUrl, username: ownerUsername, password: ownerPassword });
            const ownerResponse = await fetch(`${baseUrl}/@${ownerUsername}`, {
                headers: { cookie: ownerCookie },
            });
            const ownerBody = await ownerResponse.text();
            assert.equal(ownerResponse.status, 200);
            assert.equal(ownerBody.includes("owner-p1@example.com"), true);
            assert.equal(ownerBody.includes("010-1234-5678"), true);

            const adminCookie = await loginAs({ baseUrl, username: adminUsername, password: adminPassword });
            const adminResponse = await fetch(`${baseUrl}/@${ownerUsername}`, {
                headers: { cookie: adminCookie },
            });
            const adminBody = await adminResponse.text();
            assert.equal(adminResponse.status, 200);
            assert.equal(adminBody.includes("owner-p1@example.com"), true);
            assert.equal(adminBody.includes("010-1234-5678"), true);
        });
    } finally {
        if (adminUserId !== null) {
            await cleanupUserById(adminUserId);
        } else {
            await cleanupUserByUsername(adminUsername);
        }

        if (ownerUserId !== null) {
            await cleanupUserById(ownerUserId);
        } else {
            await cleanupUserByUsername(ownerUsername);
        }
    }
});

test("profile edit validates display name/email/phone/bio and returns 422", { skip: skipReason }, async () => {
    const username = makeId("profileval").slice(0, 32);
    const password = "profile-val-pass-123";
    let userId: number | null = null;

    const invalidCases = [
        {
            body: {
                displayName: "x".repeat(51),
                email: "valid@example.com",
                phoneNumber: "010-1234-5678",
                bio: "ok",
            },
            expectedError: /Display name must be 50 characters or less\./,
        },
        {
            body: {
                displayName: "ok",
                email: "invalid-email",
                phoneNumber: "010-1234-5678",
                bio: "ok",
            },
            expectedError: /Email format is invalid\./,
        },
        {
            body: {
                displayName: "ok",
                email: "valid@example.com",
                phoneNumber: "invalid@phone",
                bio: "ok",
            },
            expectedError: /Phone number format is invalid\./,
        },
        {
            body: {
                displayName: "ok",
                email: "valid@example.com",
                phoneNumber: "010-1234-5678",
                bio: "b".repeat(501),
            },
            expectedError: /Bio must be 500 characters or less\./,
        },
    ];

    try {
        const created = await createUserForRegister({
            username,
            passwordHash: hashPassword(password),
        });
        userId = created.userId;

        await withTestServer(async (baseUrl) => {
            const authCookie = await loginAs({ baseUrl, username, password, nextPath: "/settings/profile" });

            for (const invalidCase of invalidCases) {
                const page = await fetchFormPage({
                    baseUrl,
                    path: "/settings/profile",
                    cookie: authCookie,
                });

                const response = await fetch(`${baseUrl}/settings/profile`, {
                    method: "POST",
                    headers: {
                        "content-type": "application/x-www-form-urlencoded",
                        cookie: page.cookie,
                    },
                    body: makeProfileEditBody({
                        csrfToken: page.csrfToken,
                        displayName: invalidCase.body.displayName,
                        email: invalidCase.body.email,
                        phoneNumber: invalidCase.body.phoneNumber,
                        bio: invalidCase.body.bio,
                    }),
                    redirect: "manual",
                });
                const responseBody = await response.text();

                assert.equal(response.status, 422);
                assert.match(responseBody, invalidCase.expectedError);
            }
        });
    } finally {
        if (userId !== null) {
            await cleanupUserById(userId);
        } else {
            await cleanupUserByUsername(username);
        }
    }
});

test("profile edit updates profile and redirects to public profile page", { skip: skipReason }, async () => {
    const username = makeId("profile-ok").slice(0, 32);
    const password = "profile-ok-pass-123";
    let userId: number | null = null;

    try {
        const created = await createUserForRegister({
            username,
            passwordHash: hashPassword(password),
        });
        userId = created.userId;

        await withTestServer(async (baseUrl) => {
            const authCookie = await loginAs({ baseUrl, username, password, nextPath: "/settings/profile" });
            const page = await fetchFormPage({
                baseUrl,
                path: "/settings/profile",
                cookie: authCookie,
            });

            const response = await fetch(`${baseUrl}/settings/profile`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: page.cookie,
                },
                body: makeProfileEditBody({
                    csrfToken: page.csrfToken,
                    displayName: "Profile Success",
                    email: "profile-success@example.com",
                    phoneNumber: "010-2222-3333",
                    bio: "updated-bio-success",
                }),
                redirect: "manual",
            });

            assert.equal(response.status, 302);
            assert.equal(response.headers.get("location"), `/@${username}`);
        });

        const profile = await findUserProfileById(created.userId);
        assert.equal(profile?.displayName, "Profile Success");
        assert.equal(profile?.email, "profile-success@example.com");
        assert.equal(profile?.phoneNumber, "010-2222-3333");
        assert.equal(profile?.bio, "updated-bio-success");
    } finally {
        if (userId !== null) {
            await cleanupUserById(userId);
        } else {
            await cleanupUserByUsername(username);
        }
    }
});

test("profile edit returns 404 when DB update affects no rows", { skip: skipReason }, async () => {
    const username = makeId("profile404").slice(0, 32);
    const password = "profile-404-pass-123";
    let userId: number | null = null;

    try {
        const created = await createUserForRegister({
            username,
            passwordHash: hashPassword(password),
        });
        userId = created.userId;

        await withTestServer(async (baseUrl) => {
            const authCookie = await loginAs({ baseUrl, username, password, nextPath: "/settings/profile" });
            const page = await fetchFormPage({
                baseUrl,
                path: "/settings/profile",
                cookie: authCookie,
            });

            // Keep the authenticated session but remove the row so update affects zero rows.
            await cleanupUserById(created.userId);
            userId = null;

            const response = await fetch(`${baseUrl}/settings/profile`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: page.cookie,
                },
                body: makeProfileEditBody({
                    csrfToken: page.csrfToken,
                    displayName: "Valid Name",
                    email: "valid@example.com",
                    phoneNumber: "010-1234-5678",
                    bio: "valid-bio",
                }),
                redirect: "manual",
            });

            assert.equal(response.status, 404);
        });
    } finally {
        if (userId !== null) {
            await cleanupUserById(userId);
        } else {
            await cleanupUserByUsername(username);
        }
    }
});
