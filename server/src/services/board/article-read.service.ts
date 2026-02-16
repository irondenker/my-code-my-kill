import { isSqlInjectionTargetEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./article-read.lab.service.js";
import * as normalImplementation from "./article-read.normal.service.js";
import type { ArticleOutline, ArticleRecord } from "../../types/board.types.js";

/**
 * 게시글 조회/존재확인 서비스 facade입니다.
 *
 * 모드:
 * - 타깃별 SQLi가 활성화된 기능만 `article-read.lab.service`를 사용합니다.
 * - 그 외 기능은 `article-read.normal.service`를 사용합니다.
 */

export async function countBoardArticles(): Promise<number> {
    return normalImplementation.countBoardArticles();
}

export async function countBoardArticlesBySlug(slug: string): Promise<number> {
    if (isSqlInjectionTargetEnabled("postLookup")) {
        return labImplementation.countBoardArticlesBySlug(slug);
    }
    return normalImplementation.countBoardArticlesBySlug(slug);
}

export async function listBoardArticleOutlines(params: { offset: number; limit: number }): Promise<ArticleOutline[]> {
    if (isSqlInjectionTargetEnabled("postLookup")) {
        return labImplementation.listBoardArticleOutlines(params);
    }
    return normalImplementation.listBoardArticleOutlines(params);
}

export async function listBoardArticleOutlinesBySlug(params: {
    slug: string;
    offset: number;
    limit: number;
}): Promise<ArticleOutline[]> {
    if (isSqlInjectionTargetEnabled("postLookup")) {
        return labImplementation.listBoardArticleOutlinesBySlug(params);
    }
    return normalImplementation.listBoardArticleOutlinesBySlug(params);
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
