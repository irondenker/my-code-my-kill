import assert from "node:assert/strict";
import test from "node:test";
import {
    mapArticleForShow,
    mapArticleOutline,
    mapArticleRecord,
    mapNeighborArticle,
} from "../../../../utils/article/article-mapper.util.js";

test("mapArticleOutline maps snake_case row to typed outline", () => {
    const createdAt = new Date("2025-01-02T03:04:05.000Z");
    const mapped = mapArticleOutline({
        board_slug: "free",
        display_id: 12,
        user_id: 9,
        title: "Hello",
        author: "alice",
        created_at: createdAt,
    });

    assert.deepEqual(mapped, {
        boardSlug: "free",
        displayId: 12,
        userId: 9,
        title: "Hello",
        author: "alice",
        createdAt,
    });
});

test("mapArticleRecord maps DB row fields and nullables", () => {
    const mapped = mapArticleRecord({
        post_id: 101,
        board_id: 3,
        board_slug: "notice",
        board_name: "Notice",
        display_id: 77,
        user_id: 5,
        title: "Title",
        content: "Content",
        image_url: null,
        file_url: "attach.txt",
    });

    assert.deepEqual(mapped, {
        postId: 101,
        boardId: 3,
        boardSlug: "notice",
        boardName: "Notice",
        displayId: 77,
        userId: 5,
        title: "Title",
        content: "Content",
        imageUrl: null,
        fileUrl: "attach.txt",
    });
});

test("mapArticleForShow builds media URLs, filenames and ISO timestamps", () => {
    const createdAt = new Date("2025-03-10T10:00:00.000Z");
    const updatedAt = new Date("2025-03-11T15:30:00.000Z");
    const mapped = mapArticleForShow({
        board_id: 2,
        board_name: "Free",
        board_slug: "free",
        display_id: 8,
        user_id: 44,
        title: "Post",
        username: "bob",
        content: "Body",
        image_url: "nested/img.webp",
        file_url: "/uploads/custom/report.pdf",
        created_at: createdAt,
        updated_at: updatedAt,
    });

    assert.equal(mapped.board_slug, "free");
    assert.equal(mapped.display_id, 8);
    assert.equal(mapped.image_url, "/uploads/posts/images/nested/img.webp");
    assert.equal(mapped.file_url, "/uploads/custom/report.pdf");
    assert.equal(mapped.file_name, "report.pdf");
    assert.equal(mapped.created_at, createdAt.toISOString());
    assert.equal(mapped.updated_at, updatedAt.toISOString());
});

test("mapArticleForShow handles null media and null updated_at", () => {
    const mapped = mapArticleForShow({
        board_id: 2,
        board_name: "Free",
        board_slug: "free",
        display_id: 8,
        user_id: 44,
        title: "Post",
        username: "bob",
        content: "Body",
        image_url: null,
        file_url: null,
        created_at: new Date("2025-03-10T10:00:00.000Z"),
        updated_at: null,
    });

    assert.equal(mapped.image_url, null);
    assert.equal(mapped.file_url, null);
    assert.equal(mapped.file_name, null);
    assert.equal(mapped.updated_at, null);
});

test("mapNeighborArticle maps row or undefined to typed neighbor", () => {
    assert.deepEqual(mapNeighborArticle({ display_id: 5, title: "Prev" }), {
        display_id: 5,
        title: "Prev",
    });
    assert.equal(mapNeighborArticle(undefined), null);
});
