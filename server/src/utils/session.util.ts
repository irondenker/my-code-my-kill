import type { Request } from "express";

/**
 * express-session의 콜백 기반 API를 Promise로 감싼 유틸입니다.
 * (async/await로 컨트롤러/미들웨어에서 사용하기 위함)
 */

/**
 * 세션을 regenerate 합니다.
 * (콜백 기반 `req.session.regenerate`를 Promise로 래핑)
 *
 * @param req Express 요청 객체
 */
export function regenerateSession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
}

/**
 * 세션을 저장합니다.
 * (콜백 기반 `req.session.save`를 Promise로 래핑)
 *
 * @param req Express 요청 객체
 */
export function saveSession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
        req.session.save((err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
}

/**
 * 세션을 파기합니다.
 * (콜백 기반 `req.session.destroy`를 Promise로 래핑)
 *
 * @param req Express 요청 객체
 */
export function destroySession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
        req.session.destroy((err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
}
