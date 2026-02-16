import type { Request, Response } from "express";
import { listAuditLogs } from "../services/audit.service.js";

/**
 * 어드민 감사로그 조회 페이지를 렌더링합니다.
 * limit 쿼리 파라미터를 안전하게 정규화하여 적용합니다.
 */
export async function getAuditLogsPage(req: Request, res: Response) {
    const queryLimit = Number(req.query?.limit);
    const limit = Number.isFinite(queryLimit) && queryLimit > 0 ? queryLimit : 200;
    const logs = await listAuditLogs(limit);
    return res.render("admin/audit-logs/index", {
        logs,
        selectedLimit: Math.min(Math.max(Math.trunc(limit), 1), 500),
    });
}
