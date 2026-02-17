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

test("board list pagination normalizes invalid page and renders page slices", { skip: skipReason }, async () => {
    const username = makeId("page-user").slice(0, 32);
    const password = "page-user-pass-123";
    const boardSlug = makeId("page-board").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);

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
            name: "Pagination Board",
            description: "board-pagination-db-test",
            readAccess: "public",
            createAccess: "auth",
        });
        boardId = board.boardId;

        for (let i = 1; i <= 12; i += 1) {
            await createArticle({
                boardId: board.boardId,
                userId: user.userId,
                title: `PAGINATION_POST_${i}`,
                content: `PAGINATION_CONTENT_${i}`,
            });
        }

        await withTestServer(async (baseUrl) => {
            const authCookie = await loginAs({
                baseUrl,
                username,
                password,
                nextPath: `/board/${boardSlug}`,
            });

            const invalidPage = await fetch(`${baseUrl}/board/${boardSlug}?page=abc`, {
                headers: { cookie: authCookie },
            });
            const invalidPageBody = await invalidPage.text();
            assert.equal(invalidPage.status, 200);
            assert.match(invalidPageBody, /href="\?page=2"/);
            assert.match(
                invalidPageBody,
                /<li class="page-item active">\s*<a class="page-link" href="\?page=1">1<\/a>/
            );

            const zeroPage = await fetch(`${baseUrl}/board/${boardSlug}?page=0`, {
                headers: { cookie: authCookie },
            });
            const zeroPageBody = await zeroPage.text();
            assert.equal(zeroPage.status, 200);
            assert.match(
                zeroPageBody,
                /<li class="page-item active">\s*<a class="page-link" href="\?page=1">1<\/a>/
            );

            const secondPage = await fetch(`${baseUrl}/board/${boardSlug}?page=2`, {
                headers: { cookie: authCookie },
            });
            const secondPageBody = await secondPage.text();
            assert.equal(secondPage.status, 200);
            assert.match(
                secondPageBody,
                /<li class="page-item active">\s*<a class="page-link" href="\?page=2">2<\/a>/
            );
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
