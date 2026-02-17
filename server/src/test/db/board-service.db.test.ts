import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
import { sequelize } from "../../db/index.js";
import { createBoard, findBoardBySlug, listBoards, updateBoard } from "../../services/board.service.js";
import { cleanupBoard, makeId, runDbTests, skipReason } from "../helpers/db-test.helpers.js";

if (runDbTests) {
    before(async () => {
        await sequelize.authenticate();
    });

    after(async () => {
        await sequelize.close();
    });
}

test("board services create, query, update board metadata", { skip: skipReason }, async () => {
    const baseSlug = makeId("board").replace(/[^a-z0-9-]/g, "").toLowerCase().slice(0, 24);
    const initialSlug = `${baseSlug}-a`;
    const updatedSlug = `${baseSlug}-b`;
    let createdBoardId: number | null = null;

    try {
        const createdBoard = await createBoard({
            slug: initialSlug,
            name: "DB Board A",
            description: "board-create",
            readAccess: "auth",
            createAccess: "auth",
        });
        createdBoardId = createdBoard.boardId;
        assert.equal(createdBoard.slug, initialSlug);

        const foundInitial = await findBoardBySlug(initialSlug);
        assert.notEqual(foundInitial, null);
        assert.equal(foundInitial?.boardId, createdBoard.boardId);

        const listedBoards = await listBoards();
        assert.equal(listedBoards.some((board) => board.boardId === createdBoard.boardId), true);

        const updated = await updateBoard({
            boardId: createdBoard.boardId,
            slug: updatedSlug,
            name: "DB Board B",
            description: "board-update",
            readAccess: "owner_or_admin",
            createAccess: "admin",
        });
        assert.equal(updated, true);

        const foundUpdated = await findBoardBySlug(updatedSlug);
        assert.notEqual(foundUpdated, null);
        assert.equal(foundUpdated?.name, "DB Board B");
        assert.equal(foundUpdated?.readAccess, "owner_or_admin");
        assert.equal(foundUpdated?.createAccess, "admin");
    } finally {
        if (createdBoardId !== null) {
            await cleanupBoard(createdBoardId);
        } else {
            const board = await findBoardBySlug(initialSlug);
            if (board) {
                await cleanupBoard(board.boardId);
            }
        }
    }
});
