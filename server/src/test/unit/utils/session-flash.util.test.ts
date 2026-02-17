import assert from "node:assert/strict";
import test from "node:test";
import { consumeSessionFlashMessage, setSessionFlashMessage } from "../../../utils/session-flash.util.js";

function makeReq(sessionOverrides: Record<string, unknown> = {}) {
    return {
        session: {
            ...sessionOverrides,
        },
    } as any;
}

test("consumeSessionFlashMessage returns and clears flash value", () => {
    const req = makeReq({ boardFlashMessage: "Article has been deleted." });

    const consumed = consumeSessionFlashMessage(req, "boardFlashMessage");

    assert.equal(consumed, "Article has been deleted.");
    assert.equal("boardFlashMessage" in req.session, false);
});

test("consumeSessionFlashMessage returns null when value is missing or empty", () => {
    const reqMissing = makeReq();
    assert.equal(consumeSessionFlashMessage(reqMissing, "adminUsersFlashMessage"), null);

    const reqEmpty = makeReq({ adminUsersFlashMessage: "" });
    assert.equal(consumeSessionFlashMessage(reqEmpty, "adminUsersFlashMessage"), null);
    assert.equal(reqEmpty.session.adminUsersFlashMessage, "");
});

test("setSessionFlashMessage stores flash value by key", () => {
    const req = makeReq();

    setSessionFlashMessage(req, "adminBoardsFlashMessage", "Board has been updated.");

    assert.equal(req.session.adminBoardsFlashMessage, "Board has been updated.");
});
