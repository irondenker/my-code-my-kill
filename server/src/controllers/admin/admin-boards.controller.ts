import type { Request, Response } from "express";
import {
    createBoard,
    findBoardById,
    findBoardBySlug,
    listBoards,
    updateBoard,
} from "../../services/board.service.js";
import { HttpError } from "../../utils/http-error.js";
import { isBoardCreateAccess, isBoardReadAccess, isValidBoardSlug } from "../../utils/board-validation.util.js";
import { getPositiveIntParamOrThrow } from "../../utils/route-param.util.js";
import { normalizeString } from "../../utils/string.util.js";
import { consumeSessionFlashMessage, setSessionFlashMessage } from "../../utils/session-flash.util.js";
import { parseAdminBoardForm } from "../../schemas/admin.schema.js";
import type { BoardFormValue } from "../../types/admin.types.js";

/**
 * 어드민 보드 관리 인덱스 화면을 렌더링합니다.
 * (목록 조회 + 플래시 메시지/에러/폼 값 바인딩)
 */
async function renderAdminBoardsIndex(
    req: Request,
    res: Response,
    options?: {
        formError?: string | null;
        formSuccess?: string | null;
        formValue?: BoardFormValue;
    }
) {
    const boards = await listBoards();
    return res.render("admin/boards/index", {
        boards,
        formError: options?.formError ?? null,
        formSuccess: options?.formSuccess ?? consumeSessionFlashMessage(req, "adminBoardsFlashMessage"),
        formValue: options?.formValue ?? {
            slug: "",
            name: "",
            description: "",
            readAccess: "public",
            createAccess: "auth",
        },
    });
}

/**
 * 어드민 보드 관리 인덱스 화면을 렌더링합니다.
 * (목록 조회 + 플래시 메시지/에러/폼 값 바인딩)
 */
export function getAdminBoardsPage(req: Request, res: Response) {
    return renderAdminBoardsIndex(req, res);
}

/**
 * 어드민 보드 생성 요청을 처리합니다.
 * 입력 검증 후 보드를 생성하고, 플래시 메시지로 결과를 전달합니다.
 */
export async function postAdminBoardCreate(req: Request, res: Response) {
    // 1) 입력값을 정규화하고, 실패 시 폼 유지에 사용할 기본 formValue를 구성합니다.
    const parsedBoardForm = parseAdminBoardForm(req.body ?? {});
    const slug = parsedBoardForm.success ? parsedBoardForm.data.slug : normalizeString(req.body?.slug).toLowerCase();
    const name = parsedBoardForm.success ? parsedBoardForm.data.name : normalizeString(req.body?.name);
    const description = parsedBoardForm.success
        ? parsedBoardForm.data.description
        : normalizeString(req.body?.description, null);
    const readAccess = parsedBoardForm.success
        ? parsedBoardForm.data.readAccess
        : normalizeString(req.body?.readAccess).toLowerCase();
    const createAccess = parsedBoardForm.success
        ? parsedBoardForm.data.createAccess
        : normalizeString(req.body?.createAccess).toLowerCase();
    const formValue: BoardFormValue = {
        slug,
        name,
        description: description ?? "",
        readAccess: isBoardReadAccess(readAccess) ? readAccess : "public",
        createAccess: isBoardCreateAccess(createAccess) ? createAccess : "auth",
    };

    if (!slug || !name) {
        res.status(400);
        return renderAdminBoardsIndex(req, res, {
            formError: "Slug and name are required.",
            formSuccess: null,
            formValue,
        });
    }

    // 2) 필드 단위 검증: slug/name/description 제약을 순서대로 확인합니다.
    if (!isValidBoardSlug(slug)) {
        res.status(422);
        return renderAdminBoardsIndex(req, res, {
            formError: "Slug must be 2-50 chars and use lowercase letters, numbers, hyphens only.",
            formSuccess: null,
            formValue,
        });
    }

    if (name.length > 100) {
        res.status(422);
        return renderAdminBoardsIndex(req, res, {
            formError: "Board name must be 100 characters or less.",
            formSuccess: null,
            formValue,
        });
    }

    if (description && description.length > 255) {
        res.status(422);
        return renderAdminBoardsIndex(req, res, {
            formError: "Description must be 255 characters or less.",
            formSuccess: null,
            formValue,
        });
    }

    // 3) enum 필드(read/create access) 값 검증으로 예기치 않은 정책 입력을 차단합니다.
    if (!isBoardReadAccess(readAccess)) {
        res.status(422);
        return renderAdminBoardsIndex(req, res, {
            formError: "Invalid read access value.",
            formSuccess: null,
            formValue,
        });
    }

    if (!isBoardCreateAccess(createAccess)) {
        res.status(422);
        return renderAdminBoardsIndex(req, res, {
            formError: "Invalid create access value.",
            formSuccess: null,
            formValue,
        });
    }

    // 4) slug 중복을 점검해 보드 식별자 충돌을 방지합니다.
    const existing = await findBoardBySlug(slug);
    if (existing) {
        res.status(409);
        return renderAdminBoardsIndex(req, res, {
            formError: "This slug is already in use.",
            formSuccess: null,
            formValue,
        });
    }

    // 5) 생성 성공 시 리다이렉트 후 한 번만 보이는 플래시 메시지를 세팅합니다.
    await createBoard({
        slug,
        name,
        description,
        readAccess,
        createAccess,
    });

    setSessionFlashMessage(req, "adminBoardsFlashMessage", "Board has been created.");
    return res.redirect("/admin/boards");
}

/**
 * 어드민 보드 수정 폼 페이지를 렌더링합니다.
 */
export async function getAdminBoardEditPage(req: Request, res: Response) {
    const boardId = getPositiveIntParamOrThrow(req, "boardId");

    const board = await findBoardById(boardId);
    if (!board) {
        throw new HttpError(404, "Not Found");
    }

    return res.render("admin/boards/edit", {
        formError: null,
        board: {
            boardId: board.boardId,
            slug: board.slug,
            name: board.name,
            description: board.description ?? "",
            readAccess: board.readAccess,
            createAccess: board.createAccess,
        },
    });
}

/**
 * 어드민 보드 수정 요청을 처리합니다.
 * 입력 검증 후 보드를 업데이트하고, 플래시 메시지로 결과를 전달합니다.
 */
export async function postAdminBoardEdit(req: Request, res: Response) {
    // 1) 수정 대상 보드 존재 여부를 먼저 확인합니다.
    const boardId = getPositiveIntParamOrThrow(req, "boardId");

    const existingBoard = await findBoardById(boardId);
    if (!existingBoard) {
        throw new HttpError(404, "Not Found");
    }

    const parsedBoardForm = parseAdminBoardForm(req.body ?? {});
    const slug = parsedBoardForm.success ? parsedBoardForm.data.slug : normalizeString(req.body?.slug).toLowerCase();
    const name = parsedBoardForm.success ? parsedBoardForm.data.name : normalizeString(req.body?.name);
    const description = parsedBoardForm.success
        ? parsedBoardForm.data.description
        : normalizeString(req.body?.description, null);
    const readAccess = parsedBoardForm.success
        ? parsedBoardForm.data.readAccess
        : normalizeString(req.body?.readAccess).toLowerCase();
    const createAccess = parsedBoardForm.success
        ? parsedBoardForm.data.createAccess
        : normalizeString(req.body?.createAccess).toLowerCase();

    // 검증 실패 시 입력값을 유지한 채 동일 편집 폼으로 재렌더링합니다.
    const renderInvalid = (message: string, status = 422) => {
        return res.status(status).render("admin/boards/edit", {
            formError: message,
            board: {
                boardId,
                slug,
                name,
                description: description ?? "",
                readAccess: isBoardReadAccess(readAccess) ? readAccess : existingBoard.readAccess,
                createAccess: isBoardCreateAccess(createAccess) ? createAccess : existingBoard.createAccess,
            },
        });
    };

    // 2) 필드 단위 검증: 필수값/slug/name/description을 순서대로 점검합니다.
    if (!slug || !name) {
        return renderInvalid("Slug and name are required.", 400);
    }

    if (!isValidBoardSlug(slug)) {
        return renderInvalid("Slug must be 2-50 chars and use lowercase letters, numbers, hyphens only.");
    }

    if (name.length > 100) {
        return renderInvalid("Board name must be 100 characters or less.");
    }

    if (description && description.length > 255) {
        return renderInvalid("Description must be 255 characters or less.");
    }

    // 3) enum 필드(read/create access) 값 검증으로 정책 입력 오류를 방지합니다.
    if (!isBoardReadAccess(readAccess)) {
        return renderInvalid("Invalid read access value.");
    }

    if (!isBoardCreateAccess(createAccess)) {
        return renderInvalid("Invalid create access value.");
    }

    // 4) slug를 바꾼 경우 다른 보드와 충돌하지 않는지 확인합니다.
    const slugOwner = await findBoardBySlug(slug);
    if (slugOwner && slugOwner.boardId !== boardId) {
        return renderInvalid("This slug is already in use.", 409);
    }

    // 5) 업데이트 성공 시 목록으로 이동하고 플래시 메시지를 남깁니다.
    const updated = await updateBoard({
        boardId,
        slug,
        name,
        description,
        readAccess,
        createAccess,
    });

    if (!updated) {
        throw new HttpError(404, "Not Found");
    }

    setSessionFlashMessage(req, "adminBoardsFlashMessage", "Board has been updated.");
    return res.redirect("/admin/boards");
}
