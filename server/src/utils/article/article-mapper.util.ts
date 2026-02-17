import path from "node:path";
import type { ArticleForShow, ArticleOutline, ArticleRecord, NeighborPost } from "../../types/article.types.js";
import type { ArticleOutlineRow, ArticleRecordRow, ArticleShowRow, NeighborPostRow } from "../../types/article-data.types.js";
import { ARTICLE_ATTACHMENT_PUBLIC_BASE_PATH, ARTICLE_IMAGE_PUBLIC_BASE_PATH } from "../../constants/upload-article.constants.js";
import { buildMediaUrl } from "../upload/media-url.util.js";

/**
 * DB 조회 결과(ArticleOutlineRow)를 애플리케이션 타입(ArticleOutline)으로 매핑합니다.
 */
export function mapArticleOutline(row: ArticleOutlineRow): ArticleOutline {
    return {
        boardSlug: row.board_slug,
        displayId: Number(row.display_id),
        userId: Number(row.user_id),
        title: row.title,
        author: row.author,
        createdAt: new Date(row.created_at),
    };
}

/**
 * DB 조회 결과(ArticleRecordRow)를 애플리케이션 타입(ArticleRecord)으로 매핑합니다.
 */
export function mapArticleRecord(row: ArticleRecordRow): ArticleRecord {
    return {
        postId: Number(row.post_id),
        boardId: Number(row.board_id),
        boardSlug: row.board_slug,
        boardName: row.board_name,
        displayId: Number(row.display_id),
        userId: Number(row.user_id),
        title: row.title,
        content: row.content,
        imageUrl: row.image_url ?? null,
        fileUrl: row.file_url ?? null,
    };
}

/**
 * DB 조회 결과(ArticleShowRow)를 뷰 타입(ArticleForShow)으로 매핑합니다.
 */
export function mapArticleForShow(row: ArticleShowRow): ArticleForShow {
    return {
        board_slug: row.board_slug,
        display_id: Number(row.display_id),
        title: row.title,
        username: row.username,
        content: row.content,
        image_url: buildMediaUrl(row.image_url, ARTICLE_IMAGE_PUBLIC_BASE_PATH),
        file_url: buildMediaUrl(row.file_url, ARTICLE_ATTACHMENT_PUBLIC_BASE_PATH),
        file_name: row.file_url ? path.basename(row.file_url) : null,
        created_at: new Date(row.created_at).toISOString(),
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        user_id: Number(row.user_id),
        board_name: row.board_name,
        board_id: Number(row.board_id),
    };
}

/**
 * DB 이웃 게시글 행(최대 1행)을 NeighborPost로 매핑합니다.
 */
export function mapNeighborArticle(row: NeighborPostRow | undefined): NeighborPost {
    return row ? { display_id: Number(row.display_id), title: row.title } : null;
}
