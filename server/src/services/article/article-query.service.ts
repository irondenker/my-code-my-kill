import { isSqlInjectionTargetEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./article-query.lab.service.js";
import * as normalImplementation from "./article-query.normal.service.js";
import type { ArticleOutline, ArticleRecord } from "../../types/article.types.js";

/**
 * 게시글 조회/존재확인 서비스 facade입니다.
 *
 * 모드:
 * - 타깃별 SQLi가 활성화된 기능만 `article-query.lab.service`를 사용합니다.
 * - 그 외 기능은 `article-query.normal.service`를 사용합니다.
 */

export async function countArticles(): Promise<number> {
    return normalImplementation.countArticles();
}

export async function countArticlesBySlug(slug: string): Promise<number> {
    if (isSqlInjectionTargetEnabled("postLookup")) {
        return labImplementation.countArticlesBySlug(slug);
    }
    return normalImplementation.countArticlesBySlug(slug);
}

export async function listArticleOutlines(params: { offset: number; limit: number }): Promise<ArticleOutline[]> {
    if (isSqlInjectionTargetEnabled("postLookup")) {
        return labImplementation.listArticleOutlines(params);
    }
    return normalImplementation.listArticleOutlines(params);
}

export async function listArticleOutlinesBySlug(params: {
    slug: string;
    offset: number;
    limit: number;
}): Promise<ArticleOutline[]> {
    if (isSqlInjectionTargetEnabled("postLookup")) {
        return labImplementation.listArticleOutlinesBySlug(params);
    }
    return normalImplementation.listArticleOutlinesBySlug(params);
}

export async function findArticleBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<ArticleRecord | null> {
    if (isSqlInjectionTargetEnabled("postLookup")) {
        return labImplementation.findArticleBySlugDisplayId(params);
    }
    return normalImplementation.findArticleBySlugDisplayId(params);
}

export async function doesArticleExistBySlugDisplayId(params: { slug: string; displayId: number }): Promise<boolean> {
    if (isSqlInjectionTargetEnabled("postLookup")) {
        return labImplementation.doesArticleExistBySlugDisplayId(params);
    }
    return normalImplementation.doesArticleExistBySlugDisplayId(params);
}
