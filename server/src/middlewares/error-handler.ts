import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) {
    // 개발 환경일 때만 console.error로 오류 조회
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) console.error('[ERROR]', err);

    const status = typeof err?.status === 'number' ? //이 값이 integer가 맞는지 검증
        err.status : //맞으면 반환
        500; //아니면 500 반환

    const message = isProd ?
        '서버 오류가 발생했습니다.' : // 운영 환경일 경우 메시지 간략화
        (err?.message ?? 'Internal Server Error'); // 개발 환경일 경우 상세 메시지 전달

    // error stack 수집
    const stack = isProd ?
        null : // 운영 환경일 경우 null
        err?.stack ?? null; // 개발 환경일 경우 error stack (error stack 없으면 null)

    // // API 요청인지 SSR 요청인지 분기 (확장성 고려)
    // if (req.xhr || req.headers.accept?.includes('application/json')) {
    //     return res.status(status).json({
    //         success: false,
    //         message,
    //         stack,
    //     });
    // }

    // SSR 에러 페이지 렌더링
    res.status(status).render('error/error', {
        status,
        message,
        stack,
    });
}