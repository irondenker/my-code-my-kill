import assert from "node:assert/strict";
import test from "node:test";
import { destroySession, regenerateSession, saveSession } from "../../../utils/session.util.js";

test("regenerateSession resolves when callback succeeds", async () => {
    const req = {
        session: {
            regenerate(callback: (err?: unknown) => void) {
                callback();
            },
            save(_callback: (err?: unknown) => void) {
                return;
            },
        },
    } as any;

    await regenerateSession(req);
});

test("regenerateSession rejects when callback returns an error", async () => {
    const req = {
        session: {
            regenerate(callback: (err?: unknown) => void) {
                callback(new Error("regenerate failed"));
            },
            save(_callback: (err?: unknown) => void) {
                return;
            },
        },
    } as any;

    await assert.rejects(
        async () => regenerateSession(req),
        /regenerate failed/
    );
});

test("saveSession resolves when callback succeeds", async () => {
    const req = {
        session: {
            regenerate(_callback: (err?: unknown) => void) {
                return;
            },
            save(callback: (err?: unknown) => void) {
                callback();
            },
        },
    } as any;

    await saveSession(req);
});

test("saveSession rejects when callback returns an error", async () => {
    const req = {
        session: {
            regenerate(_callback: (err?: unknown) => void) {
                return;
            },
            save(callback: (err?: unknown) => void) {
                callback(new Error("save failed"));
            },
        },
    } as any;

    await assert.rejects(
        async () => saveSession(req),
        /save failed/
    );
});

test("destroySession resolves when callback succeeds", async () => {
    const req = {
        session: {
            regenerate(_callback: (err?: unknown) => void) {
                return;
            },
            save(_callback: (err?: unknown) => void) {
                return;
            },
            destroy(callback: (err?: unknown) => void) {
                callback();
            },
        },
    } as any;

    await destroySession(req);
});

test("destroySession rejects when callback returns an error", async () => {
    const req = {
        session: {
            regenerate(_callback: (err?: unknown) => void) {
                return;
            },
            save(_callback: (err?: unknown) => void) {
                return;
            },
            destroy(callback: (err?: unknown) => void) {
                callback(new Error("destroy failed"));
            },
        },
    } as any;

    await assert.rejects(
        async () => destroySession(req),
        /destroy failed/
    );
});
