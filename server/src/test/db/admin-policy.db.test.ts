import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
import { sequelize } from "../../db/index.js";
import { findUserMetaForAdminById } from "../../services/admin.service.js";
import { createUserForRegister, findUserByUsername } from "../../services/auth.service.js";
import { findBoardBySlug } from "../../services/board.service.js";
import { hashPassword } from "../../utils/password.util.js";
import {
    cleanupBoard,
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

test("admin controller blocks self role revoke and validates board slug", { skip: skipReason }, async () => {
    const adminUsername = makeId("adminp1").slice(0, 32);
    const adminPassword = "admin-pass-123";
    let adminUserId: number | null = null;
    let createdBoardId: number | null = null;

    try {
        const adminUser = await createUserForRegister({
            username: adminUsername,
            passwordHash: hashPassword(adminPassword),
        });
        adminUserId = adminUser.userId;
        await setUserRole(adminUser.userId, "admin");

        await withTestServer(async (baseUrl) => {
            const adminCookie = await loginAs({
                baseUrl,
                username: adminUsername,
                password: adminPassword,
                nextPath: "/admin/users",
            });

            const usersPage = await fetchFormPage({
                baseUrl,
                path: "/admin/users",
                cookie: adminCookie,
            });
            const selfRoleResponse = await fetch(`${baseUrl}/admin/users/${adminUser.userId}/role`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: usersPage.cookie,
                },
                body: `_csrf=${encodeURIComponent(usersPage.csrfToken)}&role=user`,
                redirect: "manual",
            });
            const selfRoleBody = await selfRoleResponse.text();

            assert.equal(selfRoleResponse.status, 422);
            assert.match(selfRoleBody, /You cannot revoke your own admin role\./);

            const meta = await findUserMetaForAdminById(adminUser.userId);
            assert.equal(meta?.userRole, "admin");

            const boardsPage = await fetchFormPage({
                baseUrl,
                path: "/admin/boards",
                cookie: usersPage.cookie,
            });
            const invalidSlug = "bad_slug";
            const invalidBoardResponse = await fetch(`${baseUrl}/admin/boards`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: boardsPage.cookie,
                },
                body: `_csrf=${encodeURIComponent(boardsPage.csrfToken)}&slug=${encodeURIComponent(invalidSlug)}&name=InvalidBoard&readAccess=public&createAccess=auth`,
                redirect: "manual",
            });
            const invalidBoardBody = await invalidBoardResponse.text();
            assert.equal(invalidBoardResponse.status, 422);
            assert.match(invalidBoardBody, /Slug must be 2-50 chars/);
            const invalidCreated = await findBoardBySlug(invalidSlug);
            assert.equal(invalidCreated, null);

            const validSlug = makeId("p1board").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);
            const createBoardResponse = await fetch(`${baseUrl}/admin/boards`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: boardsPage.cookie,
                },
                body: `_csrf=${encodeURIComponent(boardsPage.csrfToken)}&slug=${encodeURIComponent(validSlug)}&name=${encodeURIComponent("P1 Board")}&description=&readAccess=public&createAccess=auth`,
                redirect: "manual",
            });
            assert.equal(createBoardResponse.status, 302);
            assert.equal(createBoardResponse.headers.get("location"), "/admin/boards");

            const board = await findBoardBySlug(validSlug);
            assert.notEqual(board, null);
            createdBoardId = board?.boardId ?? null;
        });
    } finally {
        if (createdBoardId !== null) {
            await cleanupBoard(createdBoardId);
        }
        if (adminUserId !== null) {
            await cleanupUserById(adminUserId);
        } else {
            const fallback = await findUserByUsername(adminUsername);
            if (fallback) {
                await cleanupUserById(fallback.userId);
            } else {
                await cleanupUserByUsername(adminUsername);
            }
        }
    }
});
