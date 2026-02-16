export type BoardMetaRow = {
    board_id: number;
    slug: string;
    name: string;
    description: string | null;
    read_access: string;
    create_access: string;
};
