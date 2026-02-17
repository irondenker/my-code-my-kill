import assert from "node:assert/strict";
import test from "node:test";
import { runTsxInlineScript } from "../../helpers/subprocess-test.helpers.js";

type RoutingProbeResult = {
    queryCallCount: number;
    allCallsUseReplacements: boolean;
    anyCallUsesReplacements: boolean;
};

const ROUTING_PROBE_SCRIPT = `
const mode = process.env.SQLI_TEST_MODE ?? "safe";
const target = process.env.SQLI_TEST_TARGET;
const operation = process.env.SQLI_TEST_OPERATION;

if (!target || !operation) {
    throw new Error("SQLI_TEST_TARGET and SQLI_TEST_OPERATION are required.");
}

const { default: fs } = await import("node:fs");
const originalReadFileSync = fs.readFileSync;

const targets = {
    authLookup: false,
    authCreate: false,
    profileLookup: false,
    profileUpdate: false,
    boardLookup: false,
    boardCreate: false,
    boardUpdate: false,
    articleLookup: false,
    articleCreate: false,
    articleUpdate: false,
    articleDelete: false,
};

if (mode === "lab") {
    targets[target] = true;
}

const payload = JSON.stringify({
    sqlInjection: {
        enabled: mode === "lab",
        targets,
    },
});

fs.readFileSync = function patchedReadFileSync(filePath, ...rest) {
    const pathname = String(filePath);
    const isLabOptionsPath = pathname.endsWith("/lab-options.json") || pathname.endsWith("\\\\lab-options.json");
    if (isLabOptionsPath) {
        return payload;
    }
    return originalReadFileSync.call(fs, filePath, ...rest);
};

const { sequelize } = await import("./src/db/index.ts");
const calls = [];

let queryCallCount = 0;

function nextRows() {
    queryCallCount += 1;

    if (operation === "authLookup") {
        return [{
            user_id: 1,
            user_role: "user",
            username: "tester",
            password_hash: "hashed-password",
            is_active: true,
        }];
    }

    if (operation === "authCreate") {
        return [{
            user_id: 1,
            user_role: "user",
            username: "tester",
            is_active: true,
        }];
    }

    if (operation === "profileLookup") {
        return [{
            user_id: 1,
            username: "tester",
            email: null,
            phone_number: null,
            display_name: null,
            profile_image_url: null,
            bio: null,
            created_at: new Date().toISOString(),
        }];
    }

    if (operation === "profileUpdate") {
        return [{ user_id: 1 }];
    }

    if (operation === "boardLookup" || operation === "boardCreate") {
        return [{
            board_id: 1,
            slug: "board-slug",
            name: "Board",
            description: null,
            read_access: "public",
            create_access: "auth",
        }];
    }

    if (operation === "boardUpdate") {
        return [{ board_id: 1 }];
    }

    if (operation === "articleLookup") {
        return [{ total_count: "1" }];
    }

    if (operation === "articleCreate") {
        // createArticle issues two write queries: display id allocation, then insert.
        if (queryCallCount === 1) {
            return [{ display_id: 1 }];
        }
        return [];
    }

    if (operation === "articleUpdate") {
        return [{ post_id: 1 }];
    }

    if (operation === "articleDeleteAsAdmin" || operation === "articleDelete") {
        return [{ post_id: 1 }];
    }

    return [];
}

sequelize.query = async (_sql, options = {}) => {
    calls.push({
        hasReplacements: Boolean(options && options.replacements),
    });
    return nextRows();
};

sequelize.transaction = async (callback) => callback({});

if (operation === "authLookup") {
    const { findUserByUsername } = await import("./src/services/auth.service.ts");
    await findUserByUsername("tester");
} else if (operation === "authCreate") {
    const { createUserForRegister } = await import("./src/services/auth.service.ts");
    await createUserForRegister({ username: "tester", passwordHash: "hashed-password" });
} else if (operation === "profileLookup") {
    const { findPrivateProfileByUsername } = await import("./src/services/profile.service.ts");
    await findPrivateProfileByUsername("tester");
} else if (operation === "profileUpdate") {
    const { updateUserProfile } = await import("./src/services/profile.service.ts");
    await updateUserProfile({
        userId: 1,
        displayName: "Tester",
        email: "test@example.com",
        phoneNumber: "010-0000-0000",
        bio: "bio",
    });
} else if (operation === "boardLookup") {
    const { findBoardBySlug } = await import("./src/services/board.service.ts");
    await findBoardBySlug("board-slug");
} else if (operation === "boardCreate") {
    const { createBoard } = await import("./src/services/board.service.ts");
    await createBoard({
        slug: "board-slug",
        name: "Board",
        description: "desc",
        readAccess: "public",
        createAccess: "auth",
    });
} else if (operation === "boardUpdate") {
    const { updateBoard } = await import("./src/services/board.service.ts");
    await updateBoard({
        boardId: 1,
        slug: "board-slug",
        name: "Board",
        description: "desc",
        readAccess: "public",
        createAccess: "auth",
    });
} else if (operation === "articleLookup") {
    const { countArticlesBySlug } = await import("./src/services/article.service.ts");
    await countArticlesBySlug("board-slug");
} else if (operation === "articleCreate") {
    const { createArticle } = await import("./src/services/article.service.ts");
    await createArticle({
        boardId: 1,
        userId: 1,
        title: "title",
        content: "content",
        imageUrl: null,
        fileUrl: null,
    });
} else if (operation === "articleUpdate") {
    const { updateArticle } = await import("./src/services/article.service.ts");
    await updateArticle({
        postId: 1,
        title: "title",
        content: "content",
        imageUrl: null,
        fileUrl: null,
    });
} else if (operation === "articleDeleteAsAdmin") {
    const { softDeleteArticleBySlugDisplayIdAsAdmin } = await import("./src/services/article.service.ts");
    await softDeleteArticleBySlugDisplayIdAsAdmin({
        slug: "board-slug",
        displayId: 1,
    });
} else if (operation === "articleDelete") {
    const { softDeleteArticleBySlugDisplayId } = await import("./src/services/article.service.ts");
    await softDeleteArticleBySlugDisplayId({
        slug: "board-slug",
        displayId: 1,
        requestUserId: 1,
    });
} else {
    throw new Error("Unknown operation: " + operation);
}

fs.readFileSync = originalReadFileSync;

const result = {
    queryCallCount: calls.length,
    allCallsUseReplacements: calls.length > 0 && calls.every((entry) => entry.hasReplacements),
    anyCallUsesReplacements: calls.some((entry) => entry.hasReplacements),
};

console.log(JSON.stringify(result));
`;

async function runRoutingProbe(params: {
    operation: string;
    target: string;
    mode: "safe" | "lab";
}): Promise<RoutingProbeResult> {
    const { stdout } = await runTsxInlineScript({
        script: ROUTING_PROBE_SCRIPT,
        env: {
            DB_NAME: "test_db",
            DB_USER: "test_user",
            DB_PASSWORD: "test_password",
            SQLI_TEST_OPERATION: params.operation,
            SQLI_TEST_TARGET: params.target,
            SQLI_TEST_MODE: params.mode,
        },
    });

    return JSON.parse(stdout.trim()) as RoutingProbeResult;
}

const ROUTING_CASES = [
    { operation: "authLookup", target: "authLookup" },
    { operation: "authCreate", target: "authCreate" },
    { operation: "profileLookup", target: "profileLookup" },
    { operation: "profileUpdate", target: "profileUpdate" },
    { operation: "boardLookup", target: "boardLookup" },
    { operation: "boardCreate", target: "boardCreate" },
    { operation: "boardUpdate", target: "boardUpdate" },
    { operation: "articleLookup", target: "articleLookup" },
    { operation: "articleCreate", target: "articleCreate" },
    { operation: "articleUpdate", target: "articleUpdate" },
    { operation: "articleDeleteAsAdmin", target: "articleDelete" },
    { operation: "articleDelete", target: "articleDelete" },
] as const;

for (const routingCase of ROUTING_CASES) {
    test(`SQLi facade routing for ${routingCase.operation} toggles by ${routingCase.target}`, async () => {
        const safe = await runRoutingProbe({
            operation: routingCase.operation,
            target: routingCase.target,
            mode: "safe",
        });
        const lab = await runRoutingProbe({
            operation: routingCase.operation,
            target: routingCase.target,
            mode: "lab",
        });

        assert.equal(safe.queryCallCount > 0, true);
        assert.equal(lab.queryCallCount > 0, true);
        assert.equal(safe.allCallsUseReplacements, true);
        assert.equal(lab.anyCallUsesReplacements, false);
    });
}
