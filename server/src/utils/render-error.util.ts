import type { Response } from "express";

export function renderError(res: Response, status: number, message: string) {
    return res.status(status).render("errors/error", {
        status,
        message,
        stack: null,
    });
}
