import type { NextFunction, Request, Response } from "express";
import { getRequestIp, getRequestUserAgent } from "../utils/http/request-meta.util.js";

type RequestLoggerOptions = {
    /**
     * true를 반환하면 해당 요청은 access log를 남기지 않습니다.
     * (정적 파일/헬스체크 등 로그 노이즈가 큰 엔드포인트 제외용)
     */
    skip?: (req: Request) => boolean;
};

/**
 * 기본 skip 규칙입니다.
 *
 * - 헬스체크/에러 정적 페이지는 항상 제외
 * - 흔한 정적 에셋 확장자는 제외하여 로그 볼륨을 낮춥니다.
 */
function defaultSkip(req: Request): boolean {
    if (req.path === "/healthz") {
        return true;
    }
    if (req.path.startsWith("/errors/common")) {
        return true;
    }

    // Skip common static assets to avoid noisy logs.
    if (req.method === "GET") {
        const p = req.path.toLowerCase();
        if (p.endsWith(".css") || p.endsWith(".js") || p.endsWith(".map")) return true;
        if (p.endsWith(".png") || p.endsWith(".jpg") || p.endsWith(".jpeg") || p.endsWith(".gif") || p.endsWith(".webp")) return true;
        if (p.endsWith(".svg") || p.endsWith(".ico") || p.endsWith(".txt")) return true;
    }

    return false;
}

/**
 * Access log 미들웨어입니다.
 *
 * - 요청 처리 종료 시점에 method/path/status/latency/ip/ua/userId 등을 기록합니다.
 * - 서비스/컨트롤러 로직과 독립적으로 동작해, 로그 누락을 줄입니다.
 */
export function createRequestLogger(options: RequestLoggerOptions = {}) {
    const skip = options.skip ?? defaultSkip;

    return (req: Request, res: Response, next: NextFunction) => {
        // 요청 처리 시작 시점에 skip 여부를 결정합니다.
        if (skip(req)) {
            return next();
        }

        // end-to-end latency 측정을 위해 시작 시간을 고해상도로 기록합니다.
        const startedAt = process.hrtime.bigint();

        // IP/UA는 요청 내에서 변하지 않으므로 한 번만 추출합니다.
        const ipAddress = getRequestIp(req);
        const userAgent = getRequestUserAgent(req);

        const log = (result: "finish" | "close") => {
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
            const status = res.statusCode;
            // 세션 미들웨어가 선행되면 userId를 함께 기록해 추적성을 올립니다.
            const userId =
                typeof (req.session as any)?.userId === "number" ? (req.session as any).userId : null;
            const size = res.getHeader("content-length");
            const sizeText = typeof size === "string" || typeof size === "number" ? String(size) : "-";

            console.info(
                `[ACCESS] ${req.method} ${req.originalUrl} status=${status} ms=${durationMs.toFixed(1)} bytes=${sizeText} userId=${userId ?? "-"} ip=${ipAddress ?? "-"} ua="${userAgent ?? "-"}" result=${result}`
            );
        };

        // finish: 정상적으로 응답이 완료된 경우 (statusCode 포함)
        res.on("finish", () => log("finish"));
        res.on("close", () => {
            // close: 클라이언트 연결이 끊겨 응답이 완전히 끝나지 않은 경우
            if (!res.writableEnded) {
                log("close");
            }
        });

        return next();
    };
}
