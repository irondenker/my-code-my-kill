import { isSqlInjectionLabEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./post-write.lab.service.js";
import * as normalImplementation from "./post-write.normal.service.js";

/**
 * 게시글 쓰기/수정/삭제 서비스 facade입니다.
 *
 * 모드:
 * - SQLi lab 활성화: `post-write.lab.service`
 * - SQLi lab 비활성화: `post-write.normal.service`
 */

const useLabImplementation = isSqlInjectionLabEnabled();

export async function createBoardPost(params: {
    boardId: number;
    userId: number;
    title: string;
    content: string;
    imageUrl?: string | null;
    fileUrl?: string | null;
}): Promise<{ displayId: number }> {
    if (useLabImplementation) {
        return labImplementation.createBoardPost(params);
    }
    return normalImplementation.createBoardPost(params);
}

export async function updateBoardPost(params: {
    postId: number;
    title: string;
    content: string;
    imageUrl?: string | null;
    fileUrl?: string | null;
}): Promise<boolean> {
    if (useLabImplementation) {
        return labImplementation.updateBoardPost(params);
    }
    return normalImplementation.updateBoardPost(params);
}

export async function softDeletePostBySlugDisplayIdAsAdmin(params: { slug: string; displayId: number }): Promise<boolean> {
    if (useLabImplementation) {
        return labImplementation.softDeletePostBySlugDisplayIdAsAdmin(params);
    }
    return normalImplementation.softDeletePostBySlugDisplayIdAsAdmin(params);
}

export async function softDeletePostBySlugDisplayId(params: {
    slug: string;
    displayId: number;
    requestUserId: number;
}): Promise<boolean> {
    if (useLabImplementation) {
        return labImplementation.softDeletePostBySlugDisplayId(params);
    }
    return normalImplementation.softDeletePostBySlugDisplayId(params);
}
