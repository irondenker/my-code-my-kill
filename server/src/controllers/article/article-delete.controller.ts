import type { Request, Response } from "express";
import { HttpError } from "../../utils/http-error.js";
import { getPositiveIntParamOrThrow, getStringParamOrThrow } from "../../utils/route-param.util.js";
import { resolveArticleDeletePlan } from "./article.controller.helpers.js";
import {
    doesArticleExistBySlugDisplayId,
    softDeleteArticleBySlugDisplayId,
    softDeleteArticleBySlugDisplayIdAsAdmin,
} from "../../services/article.service.js";
import { setSessionFlashMessage } from "../../utils/session-flash.util.js";

export async function deleteArticle(req: Request, res: Response) {
    const slug = getStringParamOrThrow(req, "slug");
    const displayId = getPositiveIntParamOrThrow(req, "displayId");
    // 보드 정책에 따라 "관리자 전용 삭제"와 "작성자/관리자 삭제" 경로를 분리합니다.
    const deletePlan = resolveArticleDeletePlan(req, slug);
    let deleted = false;

    if (deletePlan.mode === "admin") {
        deleted = await softDeleteArticleBySlugDisplayIdAsAdmin({ slug, displayId });
    } else {
        deleted = await softDeleteArticleBySlugDisplayId({
            slug,
            displayId,
            requestUserId: deletePlan.requestUserId,
        });
    }

    if (deleted) {
        // HTML 폼(POST) 요청은 UX를 위해 보드 목록으로 리다이렉트하고,
        // API 스타일 요청(DELETE)은 본문 없이 204로 종료합니다.
        if (req.method === "POST") {
            setSessionFlashMessage(req, "boardFlashMessage", "Article has been deleted.");
            return res.redirect(`/board/${encodeURIComponent(slug)}`);
        }
        return res.status(204).send();
    }

    // 삭제 실패 시 존재 여부를 재확인해 404(대상 없음)와 403(권한 부족)을 구분합니다.
    const exists = await doesArticleExistBySlugDisplayId({ slug, displayId });
    if (!exists) {
        throw new HttpError(404, "Not Found");
    }
    throw new HttpError(403, "Forbidden");
}
