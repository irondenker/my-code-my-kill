import { isSqlInjectionTargetEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./article-write.lab.service.js";
import * as normalImplementation from "./article-write.normal.service.js";

/**
 * 게시글 쓰기/수정/삭제 서비스 facade입니다.
 *
 * 모드:
 * - 타깃별 SQLi가 활성화된 기능만 `article-write.lab.service`를 사용합니다.
 * - 그 외 기능은 `article-write.normal.service`를 사용합니다.
 */

export async function createArticle(params: {
    boardId: number;
    userId: number;
    title: string;
    content: string;
    imageUrl?: string | null;
    fileUrl?: string | null;
}): Promise<{ displayId: number }> {
    if (isSqlInjectionTargetEnabled("postCreate")) {
        return labImplementation.createArticle(params);
    }
    return normalImplementation.createArticle(params);
}

export async function updateArticle(params: {
    postId: number;
    title: string;
    content: string;
    imageUrl?: string | null;
    fileUrl?: string | null;
}): Promise<boolean> {
    if (isSqlInjectionTargetEnabled("postUpdate")) {
        return labImplementation.updateArticle(params);
    }
    return normalImplementation.updateArticle(params);
}

export async function softDeleteArticleBySlugDisplayIdAsAdmin(params: { slug: string; displayId: number }): Promise<boolean> {
    if (isSqlInjectionTargetEnabled("postUpdate")) {
        return labImplementation.softDeleteArticleBySlugDisplayIdAsAdmin(params);
    }
    return normalImplementation.softDeleteArticleBySlugDisplayIdAsAdmin(params);
}

export async function softDeleteArticleBySlugDisplayId(params: {
    slug: string;
    displayId: number;
    requestUserId: number;
}): Promise<boolean> {
    if (isSqlInjectionTargetEnabled("postUpdate")) {
        return labImplementation.softDeleteArticleBySlugDisplayId(params);
    }
    return normalImplementation.softDeleteArticleBySlugDisplayId(params);
}
