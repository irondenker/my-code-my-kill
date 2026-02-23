import type { Request, Response } from "express";
import { listAuditLogs } from "../services/audit.service.js";
import { parsePositiveInt } from "../utils/pagination.util.js";

/**
 * 어드민 감사로그 조회 페이지를 렌더링합니다.
 * limit 쿼리 파라미터를 안전하게 정규화하여 적용합니다.
 */
export async function getAuditLogsPage(req: Request, res: Response) {
    // 잘못된 입력은 기본값(200)으로 복구하고, 최종 clamp는 서비스 계층에서 한 번 더 수행합니다.
    const limit = parsePositiveInt(req.query?.limit, 200);
    const logs = await listAuditLogs(limit);
    // 뷰에서 선택값을 안정적으로 유지하도록 1~500 범위의 정수로 표시합니다.
    const selectedLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    return res.render("admin/audit-logs/index", {
        logs,
        selectedLimit,
    });
}
