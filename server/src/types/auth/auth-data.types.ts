export type UserRow = {
    user_id: number;
    user_role: string;
    username: string;
    password_hash: string;
    is_active: boolean;
    login_failed_count: number;
    login_locked_until: Date | null;
    password_reset_required: boolean;
    password_reset_token_hash: string | null;
    password_reset_token_expires_at: Date | null;
    password_reset_requested_at: Date | null;
    password_reset_used_at: Date | null;
};

export type UserPublicRow = {
    user_id: number;
    user_role: string;
    username: string;
    is_active: boolean;
};
