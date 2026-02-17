import assert from "node:assert/strict";
import test from "node:test";
import { canDeleteArticle, canEditArticle, canReadArticleForBoard, getArticleMutationPolicy } from "../../../utils/article.policy.util.js";
import { buildViewerContext } from "../../../utils/board.policy.util.js";

test("getArticleMutationPolicy returns admin-only policy for announcement board", () => {
    assert.deepEqual(getArticleMutationPolicy("announcement"), {
        update: "admin",
        delete: "admin",
    });

    assert.deepEqual(getArticleMutationPolicy("free"), {
        update: "self",
        delete: "selfOrAdmin",
    });
});

test("canReadArticleForBoard allows owner or admin only when readAccess is owner_or_admin", () => {
    const owner = buildViewerContext(7, "user");
    const otherUser = buildViewerContext(8, "user");
    const admin = buildViewerContext(1, "admin");

    assert.equal(canReadArticleForBoard("owner_or_admin", owner, 7), true);
    assert.equal(canReadArticleForBoard("owner_or_admin", otherUser, 7), false);
    assert.equal(canReadArticleForBoard("owner_or_admin", admin, 7), true);

    assert.equal(canReadArticleForBoard("public", otherUser, 7), true);
    assert.equal(canReadArticleForBoard("auth", otherUser, 7), true);
});

test("canEditArticle and canDeleteArticle follow mutation policy and ownership", () => {
    const owner = buildViewerContext(7, "user");
    const otherUser = buildViewerContext(8, "user");
    const admin = buildViewerContext(1, "admin");
    const adminOnlyPolicy = getArticleMutationPolicy("announcement");
    const selfPolicy = getArticleMutationPolicy("free");

    assert.equal(canEditArticle(adminOnlyPolicy, owner, 7), false);
    assert.equal(canEditArticle(adminOnlyPolicy, admin, 7), true);

    assert.equal(canEditArticle(selfPolicy, owner, 7), true);
    assert.equal(canEditArticle(selfPolicy, otherUser, 7), false);

    assert.equal(canDeleteArticle(adminOnlyPolicy, owner, 7), false);
    assert.equal(canDeleteArticle(adminOnlyPolicy, admin, 7), true);

    assert.equal(canDeleteArticle(selfPolicy, owner, 7), true);
    assert.equal(canDeleteArticle(selfPolicy, admin, 7), true);
    assert.equal(canDeleteArticle(selfPolicy, otherUser, 7), false);
});
