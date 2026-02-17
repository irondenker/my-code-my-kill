import assert from "node:assert/strict";
import test from "node:test";
import { clearAuthSession, establishAuthSession } from "../../../utils/auth-session.util.js";

function makeReq() {
    const calls: string[] = [];
    const req = {
        session: {
            userId: undefined as unknown,
            userRole: undefined as unknown,
            username: undefined as unknown,
            profileImageUrl: undefined as unknown,
            regenerate(callback: (err?: unknown) => void) {
                calls.push("regenerate");
                callback();
            },
            save(callback: (err?: unknown) => void) {
                calls.push("save");
                callback();
            },
            destroy(callback: (err?: unknown) => void) {
                calls.push("destroy");
                callback();
            },
        },
    } as any;
    return { req, calls };
}

test("establishAuthSession regenerates and saves with auth fields", async () => {
    const { req, calls } = makeReq();

    await establishAuthSession(req, {
        userId: 3,
        userRole: "admin",
        username: "alice",
        profileImageUrl: "avatar.webp",
    });

    assert.deepEqual(calls, ["regenerate", "save"]);
    assert.equal(req.session.userId, 3);
    assert.equal(req.session.userRole, "admin");
    assert.equal(req.session.username, "alice");
    assert.equal(req.session.profileImageUrl, "avatar.webp");
});

test("clearAuthSession delegates to destroy", async () => {
    const { req, calls } = makeReq();

    await clearAuthSession(req);

    assert.deepEqual(calls, ["destroy"]);
});
