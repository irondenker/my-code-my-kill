export type UserProfileRow = {
    user_id: number;
    username: string;
    email: string | null;
    phone_number: string | null;
    display_name: string | null;
    profile_image_url: string | null;
    bio: string | null;
    created_at: Date;
};

export type PublicProfileRow = {
    username: string;
    email: string | null;
    phone_number: string | null;
    display_name: string | null;
    profile_image_url: string | null;
    bio: string | null;
    created_at: Date;
};
