import type { Request, Response } from "express";
import {
    createUserForRegister,
    findUserByUsername,
} from "../../services/auth.service.js";
import { parseRegisterForm } from "../../schemas/auth.schema.js";
import { hashPassword, isValidPassword } from "../../utils/password.util.js";
import { isValidUsername } from "../../utils/username.util.js";
import { normalizeString } from "../../utils/string.util.js";
import { establishAuthSession } from "../../utils/auth-session.util.js";

/**
 * 회원가입 요청을 처리합니다.
 *
 * 처리:
 * - 입력 검증(username/password)
 * - username 중복 검사
 * - 비밀번호 해시 후 계정 생성
 * - 세션 재생성(regenerate) 및 로그인 상태로 전환
 */
export async function postRegister(req: Request, res: Response) {
    const parsedRegisterForm = parseRegisterForm(req.body ?? {});
    const username = parsedRegisterForm.success ? parsedRegisterForm.data.username : normalizeString(req.body?.username);
    const password = parsedRegisterForm.success ? parsedRegisterForm.data.password : String(req.body?.password ?? "");

    if (!username) {
        return res.status(400).render("auth/register", {
            formError: "Username is required.",
        });
    }

    if (!password) {
        return res.status(400).render("auth/register", {
            formError: "Password is required.",
        });
    }

    if (!isValidUsername(username)) {
        return res.status(422).render("auth/register", {
            formError: "Username must be 3-50 characters.",
        });
    }

    if (!isValidPassword(password)) {
        return res.status(422).render("auth/register", {
            formError: "Password must be at least 8 characters.",
        });
    }

    const existing = await findUserByUsername(username);
    if (existing) {
        return res.status(409).render("auth/register", {
            formError: "Username is already taken.",
        });
    }

    const passwordHash = hashPassword(password);
    const user = await createUserForRegister({ username, passwordHash });

    await establishAuthSession(req, {
        userId: user.userId,
        userRole: user.userRole,
        username: user.username,
        profileImageUrl: null,
    });

    return res.redirect("/board");
}
