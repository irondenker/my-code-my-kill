import assert from "node:assert/strict";
import test from "node:test";
import { getSessionActor, requireSessionActor } from "../../../../utils/session/session-actor.util.js";

function makeReq(sessionOverrides: Record<string, unknown> = {}) {
    return {
        session: {
            ...sessionOverrides,
        },
    } as any;
}

test("getSessionActor normalizes valid session actor values", () => {
    const req = makeReq({
        userId: 7,
        username: " alice ",
    });

    const actor = getSessionActor(req);

    assert.deepEqual(actor, {
        userId: 7,
        username: "alice",
    });
});

test("getSessionActor returns null actor when userId is invalid", () => {
    const req = makeReq({
        userId: "7",
        username: 123,
    });

    const actor = getSessionActor(req);

    assert.deepEqual(actor, {
        userId: null,
        username: null,
    });
});

test("requireSessionActor returns actor for authenticated session", () => {
    const req = makeReq({
        userId: 11,
        username: "admin",
    });

    const actor = requireSessionActor(req);

    assert.equal(actor.userId, 11);
    assert.equal(actor.username, "admin");
});

test("requireSessionActor throws 401 when session actor is missing", () => {
    const req = makeReq();

    assert.throws(
        () => requireSessionActor(req),
        /Unauthorized/
    );
});
