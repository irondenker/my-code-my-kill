import type { Request } from "express";

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