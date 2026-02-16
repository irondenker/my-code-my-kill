import type { BoardCreateAccess, BoardReadAccess } from "./board.types.js";

export type BoardMetaRow = {
    board_id: number;
    slug: string;
    name: string;
    description: string | null;
    read_access: BoardReadAccess;
    create_access: BoardCreateAccess;
};
