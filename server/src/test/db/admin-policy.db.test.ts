import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
import { sequelize } from "../../db/index.js";
import { findUserMetaForAdminById } from "../../services/admin.service.js";
import { createUserForRegister, findUserByUsername } from "../../services/auth.service.js";
import { createBoard, findBoardBySlug } from "../../services/board.service.js";
import { createArticle } from "../../services/article.service.js";
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

test("admin user status/role endpoints handle invalid value, no-change flash, and missing target", { skip: skipReason }, async () => {
    const adminUsername = makeId("admin-userflow").slice(0, 32);
    const adminPassword = "admin-userflow-pass-123";
    const targetUsername = makeId("target-userflow").slice(0, 32);

    let adminUserId: number | null = null;
    let targetUserId: number | null = null;

    try {
        const adminUser = await createUserForRegister({
            username: adminUsername,
            passwordHash: hashPassword(adminPassword),
        });
        adminUserId = adminUser.userId;
        await setUserRole(adminUser.userId, "admin");

        const targetUser = await createUserForRegister({
            username: targetUsername,
            passwordHash: hashPassword("target-userflow-pass-123"),
        });
        targetUserId = targetUser.userId;

        await withTestServer(async (baseUrl) => {
            const adminCookie = await loginAs({
                baseUrl,
                username: adminUsername,
                password: adminPassword,
                nextPath: "/admin/users",
            });

            const invalidStatusPage = await fetchFormPage({
                baseUrl,
                path: "/admin/users",
                cookie: adminCookie,
            });
            const invalidStatusResponse = await fetch(`${baseUrl}/admin/users/${targetUser.userId}/status`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: invalidStatusPage.cookie,
                },
                body: `_csrf=${encodeURIComponent(invalidStatusPage.csrfToken)}&status=paused`,
                redirect: "manual",
            });
            const invalidStatusBody = await invalidStatusResponse.text();
            assert.equal(invalidStatusResponse.status, 422);
            assert.match(invalidStatusBody, /Invalid status value\./);

            const invalidRolePage = await fetchFormPage({
                baseUrl,
                path: "/admin/users",
                cookie: adminCookie,
            });
            const invalidRoleResponse = await fetch(`${baseUrl}/admin/users/${targetUser.userId}/role`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: invalidRolePage.cookie,
                },
                body: `_csrf=${encodeURIComponent(invalidRolePage.csrfToken)}&role=owner`,
                redirect: "manual",
            });
            const invalidRoleBody = await invalidRoleResponse.text();
            assert.equal(invalidRoleResponse.status, 422);
            assert.match(invalidRoleBody, /Invalid role value\./);

            const noChangeStatusPage = await fetchFormPage({
                baseUrl,
                path: "/admin/users",
                cookie: adminCookie,
            });
            const noChangeStatusResponse = await fetch(`${baseUrl}/admin/users/${targetUser.userId}/status`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: noChangeStatusPage.cookie,
                },
                body: `_csrf=${encodeURIComponent(noChangeStatusPage.csrfToken)}&status=active`,
                redirect: "manual",
            });
            assert.equal(noChangeStatusResponse.status, 302);
            assert.equal(noChangeStatusResponse.headers.get("location"), "/admin/users");

            const statusFlashFirst = await fetch(`${baseUrl}/admin/users`, {
                headers: { cookie: noChangeStatusPage.cookie },
            });
            const statusFlashFirstBody = await statusFlashFirst.text();
            assert.equal(statusFlashFirst.status, 200);
            assert.match(statusFlashFirstBody, /User status has been updated\./);

            const statusFlashSecond = await fetch(`${baseUrl}/admin/users`, {
                headers: { cookie: noChangeStatusPage.cookie },
            });
            const statusFlashSecondBody = await statusFlashSecond.text();
            assert.equal(statusFlashSecond.status, 200);
            assert.equal(statusFlashSecondBody.includes("User status has been updated."), false);

            const noChangeRolePage = await fetchFormPage({
                baseUrl,
                path: "/admin/users",
                cookie: adminCookie,
            });
            const noChangeRoleResponse = await fetch(`${baseUrl}/admin/users/${targetUser.userId}/role`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: noChangeRolePage.cookie,
                },
                body: `_csrf=${encodeURIComponent(noChangeRolePage.csrfToken)}&role=user`,
                redirect: "manual",
            });
            assert.equal(noChangeRoleResponse.status, 302);
            assert.equal(noChangeRoleResponse.headers.get("location"), "/admin/users");

            const roleFlashFirst = await fetch(`${baseUrl}/admin/users`, {
                headers: { cookie: noChangeRolePage.cookie },
            });
            const roleFlashFirstBody = await roleFlashFirst.text();
            assert.equal(roleFlashFirst.status, 200);
            assert.match(roleFlashFirstBody, /User role has been updated\./);

            const roleFlashSecond = await fetch(`${baseUrl}/admin/users`, {
                headers: { cookie: noChangeRolePage.cookie },
            });
            const roleFlashSecondBody = await roleFlashSecond.text();
            assert.equal(roleFlashSecond.status, 200);
            assert.equal(roleFlashSecondBody.includes("User role has been updated."), false);

            const missingStatusPage = await fetchFormPage({
                baseUrl,
                path: "/admin/users",
                cookie: adminCookie,
            });
            const missingStatusResponse = await fetch(`${baseUrl}/admin/users/987654321/status`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: missingStatusPage.cookie,
                },
                body: `_csrf=${encodeURIComponent(missingStatusPage.csrfToken)}&status=inactive`,
                redirect: "manual",
            });
            assert.equal(missingStatusResponse.status, 404);

            const missingRolePage = await fetchFormPage({
                baseUrl,
                path: "/admin/users",
                cookie: adminCookie,
            });
            const missingRoleResponse = await fetch(`${baseUrl}/admin/users/987654321/role`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: missingRolePage.cookie,
                },
                body: `_csrf=${encodeURIComponent(missingRolePage.csrfToken)}&role=admin`,
                redirect: "manual",
            });
            assert.equal(missingRoleResponse.status, 404);
        });
    } finally {
        if (targetUserId !== null) {
            await cleanupUserById(targetUserId);
        } else {
            await cleanupUserByUsername(targetUsername);
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

test("admin board create validates required fields, length, enum, and duplicate slug", { skip: skipReason }, async () => {
    const adminUsername = makeId("boardcreate-admin").slice(0, 32);
    const adminPassword = "board-create-pass-123";
    const duplicateSlug = makeId("dup-board").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);

    let adminUserId: number | null = null;
    let duplicateBoardId: number | null = null;

    try {
        const adminUser = await createUserForRegister({
            username: adminUsername,
            passwordHash: hashPassword(adminPassword),
        });
        adminUserId = adminUser.userId;
        await setUserRole(adminUser.userId, "admin");

        const duplicateBoard = await createBoard({
            slug: duplicateSlug,
            name: "Duplicate Board",
            description: "duplicate-slug-check",
            readAccess: "public",
            createAccess: "auth",
        });
        duplicateBoardId = duplicateBoard.boardId;

        await withTestServer(async (baseUrl) => {
            const adminCookie = await loginAs({
                baseUrl,
                username: adminUsername,
                password: adminPassword,
                nextPath: "/admin/boards",
            });

            const cases: Array<{
                body: string;
                expectedStatus: number;
                expectedMessage: RegExp;
            }> = [
                {
                    body: "slug=&name=Board&description=&readAccess=public&createAccess=auth",
                    expectedStatus: 400,
                    expectedMessage: /Slug and name are required\./,
                },
                {
                    body: "slug=valid-board&name=&description=&readAccess=public&createAccess=auth",
                    expectedStatus: 400,
                    expectedMessage: /Slug and name are required\./,
                },
                {
                    body: `slug=${encodeURIComponent(makeId("name-len").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24))}&name=${encodeURIComponent("N".repeat(101))}&description=&readAccess=public&createAccess=auth`,
                    expectedStatus: 422,
                    expectedMessage: /Board name must be 100 characters or less\./,
                },
                {
                    body: `slug=${encodeURIComponent(makeId("desc-len").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24))}&name=${encodeURIComponent("Desc Length Board")}&description=${encodeURIComponent("d".repeat(256))}&readAccess=public&createAccess=auth`,
                    expectedStatus: 422,
                    expectedMessage: /Description must be 255 characters or less\./,
                },
                {
                    body: `slug=${encodeURIComponent(makeId("bad-read").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24))}&name=${encodeURIComponent("Bad Read Board")}&description=&readAccess=owner&createAccess=auth`,
                    expectedStatus: 422,
                    expectedMessage: /Invalid read access value\./,
                },
                {
                    body: `slug=${encodeURIComponent(makeId("bad-create").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24))}&name=${encodeURIComponent("Bad Create Board")}&description=&readAccess=public&createAccess=user`,
                    expectedStatus: 422,
                    expectedMessage: /Invalid create access value\./,
                },
                {
                    body: `slug=${encodeURIComponent(duplicateSlug)}&name=${encodeURIComponent("Duplicate Slug Board")}&description=&readAccess=public&createAccess=auth`,
                    expectedStatus: 409,
                    expectedMessage: /This slug is already in use\./,
                },
            ];

            for (const testCase of cases) {
                const page = await fetchFormPage({
                    baseUrl,
                    path: "/admin/boards",
                    cookie: adminCookie,
                });
                const response = await fetch(`${baseUrl}/admin/boards`, {
                    method: "POST",
                    headers: {
                        "content-type": "application/x-www-form-urlencoded",
                        cookie: page.cookie,
                    },
                    body: `_csrf=${encodeURIComponent(page.csrfToken)}&${testCase.body}`,
                    redirect: "manual",
                });
                const responseBody = await response.text();

                assert.equal(response.status, testCase.expectedStatus);
                assert.match(responseBody, testCase.expectedMessage);
            }
        });
    } finally {
        if (duplicateBoardId !== null) {
            await cleanupBoard(duplicateBoardId);
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

test("non-admin user is blocked with 403 on admin routes", { skip: skipReason }, async () => {
    const username = makeId("nonadmin").slice(0, 32);
    const password = "nonadmin-pass-123";
    let userId: number | null = null;

    try {
        const user = await createUserForRegister({
            username,
            passwordHash: hashPassword(password),
        });
        userId = user.userId;

        await withTestServer(async (baseUrl) => {
            const userCookie = await loginAs({
                baseUrl,
                username,
                password,
                nextPath: "/board",
            });

            const adminPage = await fetch(`${baseUrl}/admin`, {
                headers: { cookie: userCookie },
                redirect: "manual",
            });
            const adminPageBody = await adminPage.text();
            assert.equal(adminPage.status, 403);
            assert.match(adminPageBody, /data-error-code="403"/);

            const formPage = await fetchFormPage({
                baseUrl,
                path: "/settings/profile",
                cookie: userCookie,
            });
            const createBoardResponse = await fetch(`${baseUrl}/admin/boards`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: formPage.cookie,
                },
                body: `_csrf=${encodeURIComponent(formPage.csrfToken)}&slug=test-board&name=TestBoard&description=&readAccess=public&createAccess=auth`,
                redirect: "manual",
            });
            const createBoardBody = await createBoardResponse.text();
            assert.equal(createBoardResponse.status, 403);
            assert.match(createBoardBody, /data-error-code="403"/);
        });
    } finally {
        if (userId !== null) {
            await cleanupUserById(userId);
        } else {
            await cleanupUserByUsername(username);
        }
    }
});

test("admin dashboard renders stats from live counts", { skip: skipReason }, async () => {
    const adminUsername = makeId("dash-admin").slice(0, 32);
    const adminPassword = "dash-admin-pass-123";
    const writerUsername = makeId("dash-writer").slice(0, 32);
    const boardSlug = makeId("dash-board").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);

    let adminUserId: number | null = null;
    let writerUserId: number | null = null;
    let boardId: number | null = null;

    try {
        const adminUser = await createUserForRegister({
            username: adminUsername,
            passwordHash: hashPassword(adminPassword),
        });
        adminUserId = adminUser.userId;
        await setUserRole(adminUser.userId, "admin");

        const writerUser = await createUserForRegister({
            username: writerUsername,
            passwordHash: hashPassword("dash-writer-pass-123"),
        });
        writerUserId = writerUser.userId;

        const board = await createBoard({
            slug: boardSlug,
            name: "Dashboard Stats Board",
            description: "admin-dashboard-stats",
            readAccess: "public",
            createAccess: "auth",
        });
        boardId = board.boardId;

        await createArticle({
            boardId: board.boardId,
            userId: writerUser.userId,
            title: "DASHBOARD_STATS_POST",
            content: "DASHBOARD_STATS_CONTENT",
        });

        await withTestServer(async (baseUrl) => {
            const adminCookie = await loginAs({
                baseUrl,
                username: adminUsername,
                password: adminPassword,
                nextPath: "/admin",
            });

            const response = await fetch(`${baseUrl}/admin`, {
                headers: { cookie: adminCookie },
            });
            const body = await response.text();

            assert.equal(response.status, 200);
            assert.match(body, /Admin Dashboard/);
            const usersMatch = body.match(/Users<\/p>\s*<p class="h4 mb-0">(\d+)<\/p>/);
            const postsMatch = body.match(/Active posts<\/p>\s*<p class="h4 mb-0">(\d+)<\/p>/);
            const boardsMatch = body.match(/Boards<\/p>\s*<p class="h4 mb-0">(\d+)<\/p>/);

            assert.notEqual(usersMatch, null);
            assert.notEqual(postsMatch, null);
            assert.notEqual(boardsMatch, null);

            assert.equal(Number.isFinite(Number(usersMatch?.[1])), true);
            assert.equal(Number.isFinite(Number(postsMatch?.[1])), true);
            assert.equal(Number.isFinite(Number(boardsMatch?.[1])), true);
        });
    } finally {
        if (boardId !== null) {
            await cleanupBoard(boardId);
        }
        if (writerUserId !== null) {
            await cleanupUserById(writerUserId);
        } else {
            await cleanupUserByUsername(writerUsername);
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
