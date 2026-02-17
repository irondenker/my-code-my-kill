import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
import { sequelize } from "../../db/index.js";
import { createUserForRegister } from "../../services/auth.service.js";
import { createBoard } from "../../services/board.service.js";
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
import { loginAs, withTestServer } from "../helpers/http-test.helpers.js";

if (runDbTests) {
    before(async () => {
        await sequelize.authenticate();
    });

    after(async () => {
        await sequelize.close();
    });
}

test("board/article controllers enforce read/create access matrix for anon/user/admin", { skip: skipReason }, async () => {
    const userUsername = makeId("matrix-user").slice(0, 32);
    const userPassword = "matrix-user-pass-123";
    const adminUsername = makeId("matrix-admin").slice(0, 32);
    const adminPassword = "matrix-admin-pass-123";

    const publicSlug = makeId("public-board").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);
    const authSlug = makeId("auth-board").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);
    const adminSlug = makeId("admin-board").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);

    let userId: number | null = null;
    let adminUserId: number | null = null;
    const boardIds: number[] = [];

    try {
        const user = await createUserForRegister({
            username: userUsername,
            passwordHash: hashPassword(userPassword),
        });
        userId = user.userId;

        const admin = await createUserForRegister({
            username: adminUsername,
            passwordHash: hashPassword(adminPassword),
        });
        adminUserId = admin.userId;
        await setUserRole(admin.userId, "admin");

        const publicBoard = await createBoard({
            slug: publicSlug,
            name: "Public Board",
            description: "public-read",
            readAccess: "public",
            createAccess: "auth",
        });
        boardIds.push(publicBoard.boardId);

        const authBoard = await createBoard({
            slug: authSlug,
            name: "Auth Board",
            description: "auth-read",
            readAccess: "auth",
            createAccess: "auth",
        });
        boardIds.push(authBoard.boardId);

        const adminBoard = await createBoard({
            slug: adminSlug,
            name: "Admin Board",
            description: "admin-read",
            readAccess: "admin",
            createAccess: "admin",
        });
        boardIds.push(adminBoard.boardId);

        await withTestServer(async (baseUrl) => {
            const anonIndex = await fetch(`${baseUrl}/board`);
            const anonIndexBody = await anonIndex.text();
            assert.equal(anonIndex.status, 200);
            assert.equal(anonIndexBody.includes(`/board/${publicSlug}`), true);
            assert.equal(anonIndexBody.includes(`/board/${authSlug}`), false);
            assert.equal(anonIndexBody.includes(`/board/${adminSlug}`), false);

            const anonAuthRead = await fetch(`${baseUrl}/board/${authSlug}`, { redirect: "manual" });
            assert.equal(anonAuthRead.status, 302);
            assert.equal(anonAuthRead.headers.get("location"), `/login?next=${encodeURIComponent(`/board/${authSlug}`)}`);

            const anonAdminRead = await fetch(`${baseUrl}/board/${adminSlug}`, { redirect: "manual" });
            assert.equal(anonAdminRead.status, 302);
            assert.equal(anonAdminRead.headers.get("location"), `/login?next=${encodeURIComponent(`/board/${adminSlug}`)}`);

            const userCookie = await loginAs({
                baseUrl,
                username: userUsername,
                password: userPassword,
                nextPath: `/board/${authSlug}`,
            });

            const userIndex = await fetch(`${baseUrl}/board`, {
                headers: { cookie: userCookie },
            });
            const userIndexBody = await userIndex.text();
            assert.equal(userIndex.status, 200);
            assert.equal(userIndexBody.includes(`/board/${publicSlug}`), true);
            assert.equal(userIndexBody.includes(`/board/${authSlug}`), true);
            assert.equal(userIndexBody.includes(`/board/${adminSlug}`), false);

            const userAuthRead = await fetch(`${baseUrl}/board/${authSlug}`, {
                headers: { cookie: userCookie },
            });
            assert.equal(userAuthRead.status, 200);

            const userAdminRead = await fetch(`${baseUrl}/board/${adminSlug}`, {
                headers: { cookie: userCookie },
                redirect: "manual",
            });
            assert.equal(userAdminRead.status, 403);

            const userAuthCreate = await fetch(`${baseUrl}/board/${authSlug}/new`, {
                headers: { cookie: userCookie },
            });
            assert.equal(userAuthCreate.status, 200);

            const userAdminCreate = await fetch(`${baseUrl}/board/${adminSlug}/new`, {
                headers: { cookie: userCookie },
                redirect: "manual",
            });
            assert.equal(userAdminCreate.status, 403);

            const adminCookie = await loginAs({
                baseUrl,
                username: adminUsername,
                password: adminPassword,
                nextPath: `/board/${adminSlug}`,
            });

            const adminIndex = await fetch(`${baseUrl}/board`, {
                headers: { cookie: adminCookie },
            });
            const adminIndexBody = await adminIndex.text();
            assert.equal(adminIndex.status, 200);
            assert.equal(adminIndexBody.includes(`/board/${publicSlug}`), true);
            assert.equal(adminIndexBody.includes(`/board/${authSlug}`), true);
            assert.equal(adminIndexBody.includes(`/board/${adminSlug}`), true);

            const adminRead = await fetch(`${baseUrl}/board/${adminSlug}`, {
                headers: { cookie: adminCookie },
            });
            assert.equal(adminRead.status, 200);

            const adminCreate = await fetch(`${baseUrl}/board/${adminSlug}/new`, {
                headers: { cookie: adminCookie },
            });
            assert.equal(adminCreate.status, 200);
        });
    } finally {
        for (const boardId of boardIds.reverse()) {
            await cleanupBoard(boardId);
        }
        if (adminUserId !== null) {
            await cleanupUserById(adminUserId);
        } else {
            await cleanupUserByUsername(adminUsername);
        }
        if (userId !== null) {
            await cleanupUserById(userId);
        } else {
            await cleanupUserByUsername(userUsername);
        }
    }
});

test("owner_or_admin board masks list and enforces show access by ownership/admin", { skip: skipReason }, async () => {
    const ownerUsername = makeId("owner-read").slice(0, 32);
    const ownerPassword = "owner-read-pass-123";
    const viewerUsername = makeId("viewer-read").slice(0, 32);
    const viewerPassword = "viewer-read-pass-123";
    const adminUsername = makeId("admin-read").slice(0, 32);
    const adminPassword = "admin-read-pass-123";
    const boardSlug = makeId("owneronly").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);

    let ownerUserId: number | null = null;
    let viewerUserId: number | null = null;
    let adminUserId: number | null = null;
    let boardId: number | null = null;
    let ownerPostDisplayId: number | null = null;

    try {
        const owner = await createUserForRegister({
            username: ownerUsername,
            passwordHash: hashPassword(ownerPassword),
        });
        ownerUserId = owner.userId;

        const viewer = await createUserForRegister({
            username: viewerUsername,
            passwordHash: hashPassword(viewerPassword),
        });
        viewerUserId = viewer.userId;

        const admin = await createUserForRegister({
            username: adminUsername,
            passwordHash: hashPassword(adminPassword),
        });
        adminUserId = admin.userId;
        await setUserRole(admin.userId, "admin");

        const board = await createBoard({
            slug: boardSlug,
            name: "Owner Only Board",
            description: "owner-or-admin-test",
            readAccess: "owner_or_admin",
            createAccess: "auth",
        });
        boardId = board.boardId;

        const ownerPost = await createArticle({
            boardId: board.boardId,
            userId: owner.userId,
            title: "OWNER_ONLY_SECRET_TITLE",
            content: "owner-secret-content",
        });
        ownerPostDisplayId = ownerPost.displayId;

        await withTestServer(async (baseUrl) => {
            const anonShow = await fetch(`${baseUrl}/board/${boardSlug}/${ownerPost.displayId}`, { redirect: "manual" });
            assert.equal(anonShow.status, 302);
            assert.equal(anonShow.headers.get("location"), `/login?next=${encodeURIComponent(`/board/${boardSlug}/${ownerPost.displayId}`)}`);

            const viewerCookie = await loginAs({
                baseUrl,
                username: viewerUsername,
                password: viewerPassword,
                nextPath: `/board/${boardSlug}`,
            });

            const viewerList = await fetch(`${baseUrl}/board/${boardSlug}`, {
                headers: { cookie: viewerCookie },
            });
            const viewerListBody = await viewerList.text();
            assert.equal(viewerList.status, 200);
            assert.equal(viewerListBody.includes("OWNER_ONLY_SECRET_TITLE"), false);
            assert.equal(viewerListBody.includes(`/board/${boardSlug}/${ownerPost.displayId}`), false);

            const viewerShow = await fetch(`${baseUrl}/board/${boardSlug}/${ownerPost.displayId}`, {
                headers: { cookie: viewerCookie },
                redirect: "manual",
            });
            assert.equal(viewerShow.status, 403);

            const ownerCookie = await loginAs({
                baseUrl,
                username: ownerUsername,
                password: ownerPassword,
                nextPath: `/board/${boardSlug}`,
            });

            const ownerList = await fetch(`${baseUrl}/board/${boardSlug}`, {
                headers: { cookie: ownerCookie },
            });
            const ownerListBody = await ownerList.text();
            assert.equal(ownerList.status, 200);
            assert.equal(ownerListBody.includes("OWNER_ONLY_SECRET_TITLE"), true);
            assert.equal(ownerListBody.includes(`/board/${boardSlug}/${ownerPost.displayId}`), true);

            const ownerShow = await fetch(`${baseUrl}/board/${boardSlug}/${ownerPost.displayId}`, {
                headers: { cookie: ownerCookie },
            });
            const ownerShowBody = await ownerShow.text();
            assert.equal(ownerShow.status, 200);
            assert.equal(ownerShowBody.includes("OWNER_ONLY_SECRET_TITLE"), true);

            const adminCookie = await loginAs({
                baseUrl,
                username: adminUsername,
                password: adminPassword,
                nextPath: `/board/${boardSlug}`,
            });

            const adminShow = await fetch(`${baseUrl}/board/${boardSlug}/${ownerPost.displayId}`, {
                headers: { cookie: adminCookie },
            });
            assert.equal(adminShow.status, 200);
        });
    } finally {
        if (boardId !== null) {
            await cleanupBoard(boardId);
        }
        if (adminUserId !== null) {
            await cleanupUserById(adminUserId);
        } else {
            await cleanupUserByUsername(adminUsername);
        }
        if (viewerUserId !== null) {
            await cleanupUserById(viewerUserId);
        } else {
            await cleanupUserByUsername(viewerUsername);
        }
        if (ownerUserId !== null) {
            await cleanupUserById(ownerUserId);
        } else {
            await cleanupUserByUsername(ownerUsername);
        }

        // Fallback safety when board cleanup wasn't reached.
        if (ownerPostDisplayId !== null && boardId !== null) {
            await cleanupBoard(boardId);
        }
    }
});

test("board controller returns 404 for unknown board slug", { skip: skipReason }, async () => {
    await withTestServer(async (baseUrl) => {
        const missingSlug = makeId("missing-board").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);
        const response = await fetch(`${baseUrl}/board/${missingSlug}`, { redirect: "manual" });
        const body = await response.text();

        assert.equal(response.status, 404);
        assert.match(body, /data-error-code="404"/);
    });
});

test("owner_or_admin board is hidden from anon board directory but visible to authenticated users", { skip: skipReason }, async () => {
    const username = makeId("owner-dir-user").slice(0, 32);
    const password = "owner-dir-user-pass-123";
    const boardSlug = makeId("owner-dir").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);

    let userId: number | null = null;
    let boardId: number | null = null;

    try {
        const user = await createUserForRegister({
            username,
            passwordHash: hashPassword(password),
        });
        userId = user.userId;

        const board = await createBoard({
            slug: boardSlug,
            name: "Owner Directory Board",
            description: "owner-directory-visibility",
            readAccess: "owner_or_admin",
            createAccess: "auth",
        });
        boardId = board.boardId;

        await withTestServer(async (baseUrl) => {
            const anonIndex = await fetch(`${baseUrl}/board`);
            const anonIndexBody = await anonIndex.text();
            assert.equal(anonIndex.status, 200);
            assert.equal(anonIndexBody.includes(`/board/${boardSlug}`), false);

            const authCookie = await loginAs({
                baseUrl,
                username,
                password,
                nextPath: "/board",
            });
            const authIndex = await fetch(`${baseUrl}/board`, {
                headers: { cookie: authCookie },
            });
            const authIndexBody = await authIndex.text();
            assert.equal(authIndex.status, 200);
            assert.equal(authIndexBody.includes(`/board/${boardSlug}`), true);
        });
    } finally {
        if (boardId !== null) {
            await cleanupBoard(boardId);
        }
        if (userId !== null) {
            await cleanupUserById(userId);
        } else {
            await cleanupUserByUsername(username);
        }
    }
});
