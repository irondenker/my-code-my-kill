import { isSqlInjectionTargetEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./article-show.lab.service.js";
import * as normalImplementation from "./article-show.normal.service.js";
import type { ArticleForShow, NeighborPost } from "../../types/article.types.js";

/**
 * 게시글 상세/이웃 조회 서비스 facade입니다.
 *
 * 모드:
 * - 타깃별 SQLi가 활성화된 기능만 `article-show.lab.service`를 사용합니다.
 * - 그 외 기능은 `article-show.normal.service`를 사용합니다.
 */

export async function findBoardArticleForShowBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<ArticleForShow | null> {
    if (isSqlInjectionTargetEnabled("postLookup")) {
        return labImplementation.findBoardArticleForShowBySlugDisplayId(params);
    }
    return normalImplementation.findBoardArticleForShowBySlugDisplayId(params);
}

export async function findNeighborArticles(params: {
    boardId: number;
    displayId: number;
    viewerUserId?: number;
}): Promise<{ prevPost: NeighborPost; nextPost: NeighborPost }> {
    if (isSqlInjectionTargetEnabled("postLookup")) {
        return labImplementation.findNeighborArticles(params);
    }
    return normalImplementation.findNeighborArticles(params);
}
