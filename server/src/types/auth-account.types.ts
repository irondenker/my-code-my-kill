export type UserRow = {
    user_id: number;
    user_role: string;
    username: string;
    password_hash: string;
    is_active: boolean;
};

export type UserPublicRow = Omit<UserRow, "password_hash">;
