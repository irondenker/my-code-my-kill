export type UserRow = {
    user_id: number;
    user_role: string;
    username: string;
    password_hash: string;
    is_active: boolean;
};

export type UserPublicRow = {
    user_id: number;
    user_role: string;
    username: string;
    is_active: boolean;
};

