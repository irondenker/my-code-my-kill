import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV ??= "test";
process.env.SESSION_SECRET ??= "test-session-secret";
process.env.DB_NAME ??= "test_db";
process.env.DB_USER ??= "test_user";
process.env.DB_PASSWORD ??= "test_password";

const { sequelize } = await import("../../../db/index.js");
const { assertDbConnection } = await import("../../../db/assert.js");
const { closeDb } = await import("../../../db/close.js");

test("assertDbConnection delegates to sequelize.authenticate", async () => {
    let called = false;
    const original = (sequelize as any).authenticate;
    try {
        (sequelize as any).authenticate = async () => {
            called = true;
        };

        await assertDbConnection();
        assert.equal(called, true);
    } finally {
        (sequelize as any).authenticate = original;
    }
});

test("assertDbConnection surfaces authentication failures", async () => {
    const original = (sequelize as any).authenticate;
    try {
        (sequelize as any).authenticate = async () => {
            throw new Error("auth failed");
        };

        await assert.rejects(
            async () => assertDbConnection(),
            /auth failed/
        );
    } finally {
        (sequelize as any).authenticate = original;
    }
});

test("closeDb delegates to sequelize.close", async () => {
    let called = false;
    const original = (sequelize as any).close;
    try {
        (sequelize as any).close = async () => {
            called = true;
        };

        await closeDb();
        assert.equal(called, true);
    } finally {
        (sequelize as any).close = original;
    }
});

test("closeDb surfaces close failures", async () => {
    const original = (sequelize as any).close;
    try {
        (sequelize as any).close = async () => {
            throw new Error("close failed");
        };

        await assert.rejects(
            async () => closeDb(),
            /close failed/
        );
    } finally {
        (sequelize as any).close = original;
    }
});
