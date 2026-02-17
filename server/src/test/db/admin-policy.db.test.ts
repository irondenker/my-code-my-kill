import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
import { sequelize } from "../../db/index.js";
import { findUserMetaForAdminById } from "../../services/admin.service.js";
import { createUserForRegister, findUserByUsername } from "../../services/auth.service.js";
import { createBoard, findBoardBySlug } from "../../services/board.service.js";
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

test("audit logs page normalizes limit query and selected option", { skip: skipReason }, async () => {
    const adminUsername = makeId("auditadmin").slice(0, 32);
    const adminPassword = "audit-admin-pass-123";
    let adminUserId: number | null = null;

    const cases = [
        { path: "/admin/audit-logs?limit=abc", expectedSelected: "200" },
        { path: "/admin/audit-logs?limit=-1", expectedSelected: "200" },
        { path: "/admin/audit-logs?limit=50", expectedSelected: "50" },
        { path: "/admin/audit-logs?limit=9999", expectedSelected: "500" },
    ];

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
                nextPath: "/admin/audit-logs",
            });

            for (const auditCase of cases) {
                const response = await fetch(`${baseUrl}${auditCase.path}`, {
                    headers: { cookie: adminCookie },
                });
                const body = await response.text();

                assert.equal(response.status, 200);

                const selectedMatches = Array.from(
                    body.matchAll(/<option value="(50|100|200|500)" selected/g)
                );
                assert.equal(selectedMatches.length, 1);
                assert.equal(selectedMatches[0]?.[1], auditCase.expectedSelected);
            }
        });
    } finally {
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

test("admin board edit handles 422/404/409 and successful update", { skip: skipReason }, async () => {
    const adminUsername = makeId("boardedit-admin").slice(0, 32);
    const adminPassword = "board-edit-pass-123";

    const originalSlug = makeId("edit-src").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);
    const conflictSlug = makeId("edit-conf").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);
    const nextSlug = makeId("edit-next").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);

    let adminUserId: number | null = null;
    let sourceBoardId: number | null = null;
    let conflictBoardId: number | null = null;

    try {
        const adminUser = await createUserForRegister({
            username: adminUsername,
            passwordHash: hashPassword(adminPassword),
        });
        adminUserId = adminUser.userId;
        await setUserRole(adminUser.userId, "admin");

        const sourceBoard = await createBoard({
            slug: originalSlug,
            name: "Edit Source Board",
            description: "source-board",
            readAccess: "public",
            createAccess: "auth",
        });
        sourceBoardId = sourceBoard.boardId;

        const conflictBoard = await createBoard({
            slug: conflictSlug,
            name: "Edit Conflict Board",
            description: "conflict-board",
            readAccess: "public",
            createAccess: "auth",
        });
        conflictBoardId = conflictBoard.boardId;

        await withTestServer(async (baseUrl) => {
            const adminCookie = await loginAs({
                baseUrl,
                username: adminUsername,
                password: adminPassword,
                nextPath: `/admin/boards/${sourceBoard.boardId}/edit`,
            });

            const editPage = await fetchFormPage({
                baseUrl,
                path: `/admin/boards/${sourceBoard.boardId}/edit`,
                cookie: adminCookie,
            });

            const invalidEnumResponse = await fetch(`${baseUrl}/admin/boards/${sourceBoard.boardId}/edit`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: editPage.cookie,
                },
                body: `_csrf=${encodeURIComponent(editPage.csrfToken)}&slug=${encodeURIComponent(originalSlug)}&name=${encodeURIComponent("Edit Source Board")}&description=&readAccess=public&createAccess=invalid`,
                redirect: "manual",
            });
            const invalidEnumBody = await invalidEnumResponse.text();
            assert.equal(invalidEnumResponse.status, 422);
            assert.match(invalidEnumBody, /Invalid create access value\./);

            const missingBoardResponse = await fetch(`${baseUrl}/admin/boards/987654321/edit`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: editPage.cookie,
                },
                body: `_csrf=${encodeURIComponent(editPage.csrfToken)}&slug=${encodeURIComponent(nextSlug)}&name=${encodeURIComponent("Missing board")}&description=&readAccess=public&createAccess=auth`,
                redirect: "manual",
            });
            assert.equal(missingBoardResponse.status, 404);

            const conflictResponse = await fetch(`${baseUrl}/admin/boards/${sourceBoard.boardId}/edit`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: editPage.cookie,
                },
                body: `_csrf=${encodeURIComponent(editPage.csrfToken)}&slug=${encodeURIComponent(conflictSlug)}&name=${encodeURIComponent("Edit Source Board")}&description=&readAccess=public&createAccess=auth`,
                redirect: "manual",
            });
            const conflictBody = await conflictResponse.text();
            assert.equal(conflictResponse.status, 409);
            assert.match(conflictBody, /This slug is already in use\./);

            const successPage = await fetchFormPage({
                baseUrl,
                path: `/admin/boards/${sourceBoard.boardId}/edit`,
                cookie: editPage.cookie,
            });

            const successResponse = await fetch(`${baseUrl}/admin/boards/${sourceBoard.boardId}/edit`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: successPage.cookie,
                },
                body: `_csrf=${encodeURIComponent(successPage.csrfToken)}&slug=${encodeURIComponent(nextSlug)}&name=${encodeURIComponent("Edited Board Name")}&description=${encodeURIComponent("edited-description")}&readAccess=auth&createAccess=auth`,
                redirect: "manual",
            });
            assert.equal(successResponse.status, 302);
            assert.equal(successResponse.headers.get("location"), "/admin/boards");
        });

        const updated = await findBoardBySlug(nextSlug);
        assert.notEqual(updated, null);
        assert.equal(updated?.boardId, sourceBoard.boardId);
        assert.equal(updated?.name, "Edited Board Name");
        assert.equal(updated?.description, "edited-description");
        assert.equal(updated?.readAccess, "auth");
    } finally {
        if (sourceBoardId !== null) {
            await cleanupBoard(sourceBoardId);
        }
        if (conflictBoardId !== null) {
            await cleanupBoard(conflictBoardId);
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

test("audit logs page renders for admin without mutating global audit state", { skip: skipReason }, async () => {
    const adminUsername = makeId("audit-empty").slice(0, 32);
    const adminPassword = "audit-empty-pass-123";
    let adminUserId: number | null = null;

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
                nextPath: "/admin/audit-logs",
            });

            const response = await fetch(`${baseUrl}/admin/audit-logs?limit=50`, {
                headers: { cookie: adminCookie },
            });
            const body = await response.text();

            assert.equal(response.status, 200);
            assert.match(body, /action="\/admin\/audit-logs"/);
            assert.match(body, /name="limit"/);
        });
    } finally {
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
