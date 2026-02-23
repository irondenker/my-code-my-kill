import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
import { sequelize } from "../../db/index.js";
import { createUserForRegister } from "../../services/auth.service.js";
import { createBoard, findBoardBySlug } from "../../services/board.service.js";
import {
    createArticle,
    doesArticleExistBySlugDisplayId,
    softDeleteArticleBySlugDisplayIdAsAdmin,
} from "../../services/article.service.js";
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
import { getLabOptions } from "../../config/lab-options.js";

if (runDbTests) {
    before(async () => {
        await sequelize.authenticate();
    });

    after(async () => {
        await sequelize.close();
    });
}

function getAttachmentUploadRejectionExpectation(): RegExp | null {
    const { extensionCheck, mimeCheck, magicNumberCheck } = getLabOptions().uploadValidation;
    if (!extensionCheck && !mimeCheck && !magicNumberCheck) {
        return null;
    }
    if (mimeCheck) {
        return /Unsupported attachment type\./;
    }
    if (extensionCheck) {
        return /Unsupported attachment extension\./;
    }
    return /Unsupported attachment type\./;
}

test("article edit/delete routes enforce ownership and status branches", { skip: skipReason }, async () => {
    const ownerUsername = makeId("mut-owner").slice(0, 32);
    const ownerPassword = "mut-owner-pass-123";
    const otherUsername = makeId("mut-other").slice(0, 32);
    const otherPassword = "mut-other-pass-123";
    const boardSlug = makeId("mut-board").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);

    let ownerUserId: number | null = null;
    let otherUserId: number | null = null;
    let boardId: number | null = null;
    let firstDisplayId: number | null = null;
    let secondDisplayId: number | null = null;

    try {
        const owner = await createUserForRegister({
            username: ownerUsername,
            passwordHash: hashPassword(ownerPassword),
        });
        ownerUserId = owner.userId;

        const other = await createUserForRegister({
            username: otherUsername,
            passwordHash: hashPassword(otherPassword),
        });
        otherUserId = other.userId;

        const board = await createBoard({
            slug: boardSlug,
            name: "Mutation Board",
            description: "article-mutation-access-test",
            readAccess: "public",
            createAccess: "auth",
        });
        boardId = board.boardId;

        const first = await createArticle({
            boardId: board.boardId,
            userId: owner.userId,
            title: "OWNER_ORIGINAL_TITLE",
            content: "OWNER_ORIGINAL_CONTENT",
        });
        firstDisplayId = first.displayId;

        const second = await createArticle({
            boardId: board.boardId,
            userId: owner.userId,
            title: "OWNER_SECOND_TITLE",
            content: "OWNER_SECOND_CONTENT",
        });
        secondDisplayId = second.displayId;

        await withTestServer(async (baseUrl) => {
            const ownerCookie = await loginAs({
                baseUrl,
                username: ownerUsername,
                password: ownerPassword,
                nextPath: `/board/${boardSlug}/${first.displayId}`,
            });
            const otherCookie = await loginAs({
                baseUrl,
                username: otherUsername,
                password: otherPassword,
                nextPath: `/board/${boardSlug}/${first.displayId}`,
            });

            const ownerEditPage = await fetch(`${baseUrl}/board/${boardSlug}/${first.displayId}/edit`, {
                headers: { cookie: ownerCookie },
            });
            assert.equal(ownerEditPage.status, 200);

            const otherEditPage = await fetch(`${baseUrl}/board/${boardSlug}/${first.displayId}/edit`, {
                headers: { cookie: otherCookie },
                redirect: "manual",
            });
            assert.equal(otherEditPage.status, 403);

            const ownerEditForm = await fetchFormPage({
                baseUrl,
                path: `/board/${boardSlug}/${first.displayId}/edit`,
                cookie: ownerCookie,
            });

            const invalidEditResponse = await fetch(`${baseUrl}/board/${boardSlug}/${first.displayId}/edit`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: ownerEditForm.cookie,
                },
                body: `_csrf=${encodeURIComponent(ownerEditForm.csrfToken)}&title=&content=`,
                redirect: "manual",
            });
            const invalidEditBody = await invalidEditResponse.text();
            assert.equal(invalidEditResponse.status, 400);
            assert.match(invalidEditBody, /Title and content are required\./);

            const validEditForm = await fetchFormPage({
                baseUrl,
                path: `/board/${boardSlug}/${first.displayId}/edit`,
                cookie: ownerCookie,
            });
            const validEditResponse = await fetch(`${baseUrl}/board/${boardSlug}/${first.displayId}/edit`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: validEditForm.cookie,
                },
                body: `_csrf=${encodeURIComponent(validEditForm.csrfToken)}&title=${encodeURIComponent("OWNER_EDITED_TITLE")}&content=${encodeURIComponent("OWNER_EDITED_CONTENT")}`,
                redirect: "manual",
            });
            assert.equal(validEditResponse.status, 302);
            assert.equal(validEditResponse.headers.get("location"), `/board/${boardSlug}/${first.displayId}`);

            const editedShow = await fetch(`${baseUrl}/board/${boardSlug}/${first.displayId}`, {
                headers: { cookie: ownerCookie },
            });
            const editedShowBody = await editedShow.text();
            assert.equal(editedShow.status, 200);
            assert.equal(editedShowBody.includes("OWNER_EDITED_TITLE"), true);

            const otherSettingsForm = await fetchFormPage({
                baseUrl,
                path: "/settings/profile",
                cookie: otherCookie,
            });
            const otherDeleteAttempt = await fetch(`${baseUrl}/board/${boardSlug}/${first.displayId}`, {
                method: "DELETE",
                headers: {
                    cookie: otherSettingsForm.cookie,
                    "csrf-token": otherSettingsForm.csrfToken,
                },
                redirect: "manual",
            });
            assert.equal(otherDeleteAttempt.status, 403);

            const ownerSettingsForm = await fetchFormPage({
                baseUrl,
                path: "/settings/profile",
                cookie: ownerCookie,
            });
            const missingDelete = await fetch(`${baseUrl}/board/${boardSlug}/999999`, {
                method: "DELETE",
                headers: {
                    cookie: ownerSettingsForm.cookie,
                    "csrf-token": ownerSettingsForm.csrfToken,
                },
                redirect: "manual",
            });
            assert.equal(missingDelete.status, 404);

            const ownerDeleteApi = await fetch(`${baseUrl}/board/${boardSlug}/${second.displayId}`, {
                method: "DELETE",
                headers: {
                    cookie: ownerSettingsForm.cookie,
                    "csrf-token": ownerSettingsForm.csrfToken,
                },
                redirect: "manual",
            });
            assert.equal(ownerDeleteApi.status, 204);

            const secondShowAfterDelete = await fetch(`${baseUrl}/board/${boardSlug}/${second.displayId}`, {
                headers: { cookie: ownerCookie },
                redirect: "manual",
            });
            assert.equal(secondShowAfterDelete.status, 404);

            const ownerShowForm = await fetchFormPage({
                baseUrl,
                path: `/board/${boardSlug}/${first.displayId}`,
                cookie: ownerCookie,
            });
            const ownerDeletePost = await fetch(`${baseUrl}/board/${boardSlug}/${first.displayId}/delete`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: ownerShowForm.cookie,
                },
                body: `_csrf=${encodeURIComponent(ownerShowForm.csrfToken)}`,
                redirect: "manual",
            });
            assert.equal(ownerDeletePost.status, 302);
            assert.equal(ownerDeletePost.headers.get("location"), `/board/${boardSlug}`);

            const boardAfterDelete = await fetch(`${baseUrl}/board/${boardSlug}`, {
                headers: { cookie: ownerCookie },
            });
            const boardAfterDeleteBody = await boardAfterDelete.text();
            assert.equal(boardAfterDelete.status, 200);
            assert.equal(boardAfterDeleteBody.includes("Article has been deleted."), true);
            assert.equal(boardAfterDeleteBody.includes("OWNER_EDITED_TITLE"), false);

            const boardAfterDeleteSecond = await fetch(`${baseUrl}/board/${boardSlug}`, {
                headers: { cookie: ownerCookie },
            });
            const boardAfterDeleteSecondBody = await boardAfterDeleteSecond.text();
            assert.equal(boardAfterDeleteSecond.status, 200);
            assert.equal(boardAfterDeleteSecondBody.includes("Article has been deleted."), false);
        });

        const firstExists = await doesArticleExistBySlugDisplayId({
            slug: boardSlug,
            displayId: first.displayId,
        });
        const secondExists = await doesArticleExistBySlugDisplayId({
            slug: boardSlug,
            displayId: second.displayId,
        });
        assert.equal(firstExists, false);
        assert.equal(secondExists, false);
    } finally {
        if (firstDisplayId !== null) {
            await softDeleteArticleBySlugDisplayIdAsAdmin({ slug: boardSlug, displayId: firstDisplayId });
        }
        if (secondDisplayId !== null) {
            await softDeleteArticleBySlugDisplayIdAsAdmin({ slug: boardSlug, displayId: secondDisplayId });
        }

        if (boardId !== null) {
            await cleanupBoard(boardId);
        }
        if (otherUserId !== null) {
            await cleanupUserById(otherUserId);
        } else {
            await cleanupUserByUsername(otherUsername);
        }
        if (ownerUserId !== null) {
            await cleanupUserById(ownerUserId);
        } else {
            await cleanupUserByUsername(ownerUsername);
        }
    }
});

test("article controller returns 404 for missing board or missing post edit target", { skip: skipReason }, async () => {
    const username = makeId("missing-article").slice(0, 32);
    const password = "missing-article-pass-123";
    const existingBoardSlug = makeId("exists-board").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);
    const missingBoardSlug = makeId("missing-board").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);

    let userId: number | null = null;
    let boardId: number | null = null;

    try {
        const user = await createUserForRegister({
            username,
            passwordHash: hashPassword(password),
        });
        userId = user.userId;

        const board = await createBoard({
            slug: existingBoardSlug,
            name: "Existing Board",
            description: "article-missing-targets",
            readAccess: "public",
            createAccess: "auth",
        });
        boardId = board.boardId;

        await withTestServer(async (baseUrl) => {
            const authCookie = await loginAs({
                baseUrl,
                username,
                password,
                nextPath: `/board/${existingBoardSlug}/new`,
            });

            const missingBoardResponse = await fetch(`${baseUrl}/board/${missingBoardSlug}/new`, {
                headers: { cookie: authCookie },
                redirect: "manual",
            });
            assert.equal(missingBoardResponse.status, 404);

            const missingPostResponse = await fetch(`${baseUrl}/board/${existingBoardSlug}/999999/edit`, {
                headers: { cookie: authCookie },
                redirect: "manual",
            });
            assert.equal(missingPostResponse.status, 404);
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

test("article create/edit return 422 when upload validation throws ArticleUploadError", { skip: skipReason }, async () => {
    const expectedUploadErrorPattern = getAttachmentUploadRejectionExpectation();
    const username = makeId("article-upload-err").slice(0, 32);
    const password = "article-upload-err-pass-123";
    const boardSlug = makeId("upload-err-board").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);

    let userId: number | null = null;
    let boardId: number | null = null;
    let displayId: number | null = null;

    try {
        const user = await createUserForRegister({
            username,
            passwordHash: hashPassword(password),
        });
        userId = user.userId;

        const board = await createBoard({
            slug: boardSlug,
            name: "Upload Error Board",
            description: "article-upload-error-branch",
            readAccess: "public",
            createAccess: "auth",
        });
        boardId = board.boardId;

        const created = await createArticle({
            boardId: board.boardId,
            userId: user.userId,
            title: "UPLOAD_ERROR_BASE_POST",
            content: "UPLOAD_ERROR_BASE_CONTENT",
        });
        displayId = created.displayId;

        await withTestServer(async (baseUrl) => {
            const authCookie = await loginAs({
                baseUrl,
                username,
                password,
                nextPath: `/board/${boardSlug}`,
            });
            const badAttachmentBytes = Uint8Array.from(Buffer.from("not-a-supported-attachment", "utf8"));

            const createForm = await fetchFormPage({
                baseUrl,
                path: `/board/${boardSlug}/new`,
                cookie: authCookie,
            });
            const createPayload = new FormData();
            createPayload.set("_csrf", createForm.csrfToken);
            createPayload.set("title", "UPLOAD_ERR_CREATE_TITLE");
            createPayload.set("content", "UPLOAD_ERR_CREATE_CONTENT");
            createPayload.set("attachment", new Blob([badAttachmentBytes], { type: "application/octet-stream" }), "malware.bin");

            const createResponse = await fetch(`${baseUrl}/board/${boardSlug}`, {
                method: "POST",
                headers: {
                    cookie: createForm.cookie,
                },
                body: createPayload,
                redirect: "manual",
            });
            const createBody = await createResponse.text();
            if (expectedUploadErrorPattern) {
                assert.equal(createResponse.status, 422);
                assert.match(createBody, expectedUploadErrorPattern);
            } else {
                assert.equal(createResponse.status, 302);
            }

            const editForm = await fetchFormPage({
                baseUrl,
                path: `/board/${boardSlug}/${created.displayId}/edit`,
                cookie: authCookie,
            });
            const editPayload = new FormData();
            editPayload.set("_csrf", editForm.csrfToken);
            editPayload.set("title", "UPLOAD_ERR_EDIT_TITLE");
            editPayload.set("content", "UPLOAD_ERR_EDIT_CONTENT");
            editPayload.set("attachment", new Blob([badAttachmentBytes], { type: "application/octet-stream" }), "malware.bin");

            const editResponse = await fetch(`${baseUrl}/board/${boardSlug}/${created.displayId}/edit`, {
                method: "POST",
                headers: {
                    cookie: editForm.cookie,
                },
                body: editPayload,
                redirect: "manual",
            });
            const editBody = await editResponse.text();
            if (expectedUploadErrorPattern) {
                assert.equal(editResponse.status, 422);
                assert.match(editBody, expectedUploadErrorPattern);
            } else {
                assert.equal(editResponse.status, 302);
            }
        });
    } finally {
        if (displayId !== null) {
            await softDeleteArticleBySlugDisplayIdAsAdmin({ slug: boardSlug, displayId });
        }
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

test("announcement board delete is admin-only at route level", { skip: skipReason }, async () => {
    const ownerUsername = makeId("ann-owner").slice(0, 32);
    const ownerPassword = "ann-owner-pass-123";
    const adminUsername = makeId("ann-admin").slice(0, 32);
    const adminPassword = "ann-admin-pass-123";

    let ownerUserId: number | null = null;
    let adminUserId: number | null = null;
    let createdAnnouncementBoardId: number | null = null;
    let announcementBoardId: number | null = null;
    let announcementDisplayId: number | null = null;

    try {
        const owner = await createUserForRegister({
            username: ownerUsername,
            passwordHash: hashPassword(ownerPassword),
        });
        ownerUserId = owner.userId;

        const admin = await createUserForRegister({
            username: adminUsername,
            passwordHash: hashPassword(adminPassword),
        });
        adminUserId = admin.userId;
        await setUserRole(admin.userId, "admin");

        let announcementBoard = await findBoardBySlug("announcement");
        if (!announcementBoard) {
            announcementBoard = await createBoard({
                slug: "announcement",
                name: "Announcement",
                description: "announcement-board-test",
                readAccess: "public",
                createAccess: "admin",
            });
            createdAnnouncementBoardId = announcementBoard.boardId;
        }
        announcementBoardId = announcementBoard.boardId;

        const created = await createArticle({
            boardId: announcementBoard.boardId,
            userId: owner.userId,
            title: "ANNOUNCEMENT_OWNER_POST",
            content: "announcement-content",
        });
        announcementDisplayId = created.displayId;

        await withTestServer(async (baseUrl) => {
            const ownerCookie = await loginAs({
                baseUrl,
                username: ownerUsername,
                password: ownerPassword,
                nextPath: "/settings/profile",
            });
            const adminCookie = await loginAs({
                baseUrl,
                username: adminUsername,
                password: adminPassword,
                nextPath: "/settings/profile",
            });

            const ownerForm = await fetchFormPage({
                baseUrl,
                path: "/settings/profile",
                cookie: ownerCookie,
            });
            const ownerDelete = await fetch(`${baseUrl}/board/announcement/${created.displayId}`, {
                method: "DELETE",
                headers: {
                    cookie: ownerForm.cookie,
                    "csrf-token": ownerForm.csrfToken,
                },
                redirect: "manual",
            });
            assert.equal(ownerDelete.status, 403);

            const adminForm = await fetchFormPage({
                baseUrl,
                path: "/settings/profile",
                cookie: adminCookie,
            });
            const adminDelete = await fetch(`${baseUrl}/board/announcement/${created.displayId}`, {
                method: "DELETE",
                headers: {
                    cookie: adminForm.cookie,
                    "csrf-token": adminForm.csrfToken,
                },
                redirect: "manual",
            });
            assert.equal(adminDelete.status, 204);
        });

        const existsAfterAdminDelete = await doesArticleExistBySlugDisplayId({
            slug: "announcement",
            displayId: created.displayId,
        });
        assert.equal(existsAfterAdminDelete, false);
    } finally {
        if (announcementDisplayId !== null && announcementBoardId !== null && ownerUserId !== null) {
            await sequelize.query(
                `
                DELETE FROM posts
                WHERE board_id = :boardId
                  AND display_id = :displayId
                  AND user_id = :userId
                `,
                {
                    replacements: {
                        boardId: announcementBoardId,
                        displayId: announcementDisplayId,
                        userId: ownerUserId,
                    },
                }
            );
        }
        if (announcementDisplayId !== null) {
            await softDeleteArticleBySlugDisplayIdAsAdmin({
                slug: "announcement",
                displayId: announcementDisplayId,
            });
        }
        if (createdAnnouncementBoardId !== null) {
            await cleanupBoard(createdAnnouncementBoardId);
        }
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
