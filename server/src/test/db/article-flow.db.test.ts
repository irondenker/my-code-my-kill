import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
import { sequelize } from "../../db/index.js";
import {
    createArticle,
    countArticlesBySlug,
    doesArticleExistBySlugDisplayId,
    findArticleBySlugDisplayId,
    softDeleteArticleBySlugDisplayId,
} from "../../services/article.service.js";
import { createUserForRegister } from "../../services/auth.service.js";
import { createBoard } from "../../services/board.service.js";
import { hashPassword } from "../../utils/password.util.js";
import {
    cleanupBoard,
    cleanupUserById,
    cleanupUserByUsername,
    makeId,
    runDbTests,
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

test("article services create, read, count, and soft-delete by board slug/display id", { skip: skipReason }, async () => {
    const username = makeId("writer").slice(0, 32);
    const boardSlug = makeId("article").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 30);
    let userId: number | null = null;
    let boardId: number | null = null;

    try {
        const user = await createUserForRegister({
            username,
            passwordHash: hashPassword("article-password"),
        });
        userId = user.userId;

        const board = await createBoard({
            slug: boardSlug,
            name: "Article Board",
            description: "article-service-test",
            readAccess: "auth",
            createAccess: "auth",
        });
        boardId = board.boardId;

        const created = await createArticle({
            boardId: board.boardId,
            userId: user.userId,
            title: "Service Article",
            content: "Service article content",
        });
        assert.equal(created.displayId > 0, true);

        const countBeforeDelete = await countArticlesBySlug(boardSlug);
        assert.equal(countBeforeDelete, 1);

        const article = await findArticleBySlugDisplayId({
            slug: boardSlug,
            displayId: created.displayId,
        });
        assert.notEqual(article, null);
        assert.equal(article?.title, "Service Article");
        assert.equal(article?.userId, user.userId);

        const existsBeforeDelete = await doesArticleExistBySlugDisplayId({
            slug: boardSlug,
            displayId: created.displayId,
        });
        assert.equal(existsBeforeDelete, true);

        const deleted = await softDeleteArticleBySlugDisplayId({
            slug: boardSlug,
            displayId: created.displayId,
            requestUserId: user.userId,
        });
        assert.equal(deleted, true);

        const existsAfterDelete = await doesArticleExistBySlugDisplayId({
            slug: boardSlug,
            displayId: created.displayId,
        });
        assert.equal(existsAfterDelete, false);

        const countAfterDelete = await countArticlesBySlug(boardSlug);
        assert.equal(countAfterDelete, 0);
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

test("authenticated user can create and read an article via HTTP flow", { skip: skipReason }, async () => {
    const username = makeId("webwriter").slice(0, 32);
    const password = "writer-pass-123";
    const boardSlug = makeId("webboard").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);

    let boardId: number | null = null;
    let userId: number | null = null;

    try {
        const board = await createBoard({
            slug: boardSlug,
            name: "Web Board",
            description: "http-flow-dbtest",
            readAccess: "auth",
            createAccess: "auth",
        });
        boardId = board.boardId;

        const created = await createUserForRegister({
            username,
            passwordHash: hashPassword(password),
        });
        userId = created.userId;

        await withTestServer(async (baseUrl) => {
            const authCookie = await loginAs({
                baseUrl,
                username,
                password,
                nextPath: `/board/${boardSlug}`,
            });

            const newPage = await fetchFormPage({
                baseUrl,
                path: `/board/${encodeURIComponent(boardSlug)}/new`,
                cookie: authCookie,
            });
            const createResponse = await fetch(`${baseUrl}/board/${encodeURIComponent(boardSlug)}`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    cookie: newPage.cookie,
                },
                body: `_csrf=${encodeURIComponent(newPage.csrfToken)}&title=${encodeURIComponent("HTTP DB Title")}&content=${encodeURIComponent("HTTP DB Content")}`,
                redirect: "manual",
            });

            assert.equal(createResponse.status, 302);
            const location = createResponse.headers.get("location");
            assert.equal(typeof location === "string", true);
            assert.match(location ?? "", new RegExp(`^/board/${boardSlug}/\\d+$`));

            const showResponse = await fetch(`${baseUrl}${location}`, {
                headers: {
                    cookie: newPage.cookie,
                },
            });
            const showBody = await showResponse.text();
            assert.equal(showResponse.status, 200);
            assert.match(showBody, /HTTP DB Title/);
            assert.match(showBody, /HTTP DB Content/);
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
