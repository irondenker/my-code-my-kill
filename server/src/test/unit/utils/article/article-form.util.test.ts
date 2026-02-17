import assert from "node:assert/strict";
import test from "node:test";
import {
    buildArticleCreateFormViewModel,
    buildArticleEditFormViewModel,
    validateArticleFormInput,
} from "../../../../utils/article/article-form.util.js";

test("validateArticleFormInput returns 400 when title/content is missing", () => {
    const missingTitle = validateArticleFormInput({
        title: "",
        content: "body",
    });
    assert.deepEqual(missingTitle, {
        status: 400,
        message: "Title and content are required.",
    });

    const missingContent = validateArticleFormInput({
        title: "title",
        content: "",
    });
    assert.deepEqual(missingContent, {
        status: 400,
        message: "Title and content are required.",
    });
});

test("validateArticleFormInput returns 422 for invalid title/content length", () => {
    const invalidTitle = validateArticleFormInput({
        title: "a",
        content: "valid content",
    });
    assert.deepEqual(invalidTitle, {
        status: 422,
        message: "Title or content is invalid.",
    });

    const invalidContent = validateArticleFormInput({
        title: "valid title",
        content: "x",
    });
    assert.deepEqual(invalidContent, {
        status: 422,
        message: "Title or content is invalid.",
    });
});

test("validateArticleFormInput returns null for valid input", () => {
    const result = validateArticleFormInput({
        title: "A valid title",
        content: "A valid body text.",
    });
    assert.equal(result, null);
});

test("buildArticleCreateFormViewModel omits optional fields when undefined", () => {
    const model = buildArticleCreateFormViewModel({
        boardSlug: "free",
        boardDisplayName: "Free Board",
        formError: null,
    });

    assert.equal(model.boardSlug, "free");
    assert.equal(model.boardDisplayName, "Free Board");
    assert.equal(model.formError, null);
    assert.equal("title" in model, false);
    assert.equal("content" in model, false);
});

test("buildArticleCreateFormViewModel includes optional title/content when provided", () => {
    const model = buildArticleCreateFormViewModel({
        boardSlug: "free",
        boardDisplayName: "Free Board",
        formError: "invalid",
        title: "My title",
        content: "My content",
    });

    assert.equal(model.title, "My title");
    assert.equal(model.content, "My content");
});

test("buildArticleEditFormViewModel maps public urls and filename basenames", () => {
    const model = buildArticleEditFormViewModel({
        post: {
            boardSlug: "free",
            boardName: "Free Board",
            displayId: 7,
            imageUrl: "nested/path/cover.webp",
            fileUrl: "/uploads/custom/manual.pdf",
        },
        title: "Edited",
        content: "Edited content",
        formError: null,
    });

    assert.equal(model.boardSlug, "free");
    assert.equal(model.boardDisplayName, "Free Board");
    assert.equal(model.displayId, 7);
    assert.equal(model.imageUrl, "/uploads/posts/images/nested/path/cover.webp");
    assert.equal(model.imageName, "cover.webp");
    assert.equal(model.fileUrl, "/uploads/custom/manual.pdf");
    assert.equal(model.fileName, "manual.pdf");
    assert.equal(model.formError, null);
});
