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
