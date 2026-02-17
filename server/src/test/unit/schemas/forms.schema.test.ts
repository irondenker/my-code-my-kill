import assert from "node:assert/strict";
import test from "node:test";
import { parseAdminBoardForm, parseAdminUserRoleForm, parseAdminUserStatusForm } from "../../../schemas/admin.schema.js";
import { parseProfileEditForm } from "../../../schemas/user.schema.js";
import { parseArticleForm } from "../../../schemas/article.schema.js";
import { parseSstiRenderForm } from "../../../schemas/lab.schema.js";

test("admin form schemas normalize lower-case control fields", () => {
    const board = parseAdminBoardForm({
        slug: "  Notice ",
        name: " 공지 ",
        readAccess: "ADMIN",
        createAccess: "AUTH",
        description: "  desc ",
    });
    assert.equal(board.success, true);
    if (board.success) {
        assert.equal(board.data.slug, "notice");
        assert.equal(board.data.readAccess, "admin");
        assert.equal(board.data.createAccess, "auth");
        assert.equal(board.data.description, "desc");
    }

    const status = parseAdminUserStatusForm({ status: "INACTIVE" });
    assert.equal(status.success, true);
    if (status.success) {
        assert.equal(status.data.status, "inactive");
    }

    const role = parseAdminUserRoleForm({ role: "ADMIN" });
    assert.equal(role.success, true);
    if (role.success) {
        assert.equal(role.data.role, "admin");
    }
});

test("profile/article/lab schemas normalize body fields", () => {
    const profile = parseProfileEditForm({
        displayName: "  Alice  ",
        email: "  a@b.com ",
        phoneNumber: "",
        bio: "  hello ",
    });
    assert.equal(profile.success, true);
    if (profile.success) {
        assert.equal(profile.data.displayName, "Alice");
        assert.equal(profile.data.email, "a@b.com");
        assert.equal(profile.data.phoneNumber, null);
        assert.equal(profile.data.bio, "hello");
    }

    const article = parseArticleForm({
        title: "  title  ",
        content: "  body  ",
    });
    assert.equal(article.success, true);
    if (article.success) {
        assert.equal(article.data.title, "title");
        assert.equal(article.data.content, "body");
    }

    const ssti = parseSstiRenderForm({
        title: 123,
        template: undefined,
    });
    assert.equal(ssti.success, true);
    if (ssti.success) {
        assert.equal(ssti.data.title, "");
        assert.equal(ssti.data.template, "");
    }
});
