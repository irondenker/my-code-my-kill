import { spawnSync } from "node:child_process";
import path from "node:path";

const FLOWMAP_DIR = "docs/flowmap";

type GitResult = {
    status: number;
    stdout: string;
    stderr: string;
    errorMessage: string | null;
};

function runGit(args: string[], cwd: string): GitResult {
    const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8",
    });

    return {
        status: result.status ?? 1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        errorMessage: result.error ? String(result.error.message ?? result.error) : null,
    };
}

function printGitFailureDetails(result: GitResult): void {
    if (result.errorMessage) {
        console.error(`[flowmap-drift] git spawn error: ${result.errorMessage}`);
    }
    if (result.stderr.trim().length > 0) {
        console.error(result.stderr.trim());
    }
}

async function main() {
    // generate-flowmap.ts has its own main() execution side effect.
    await import("./generate-flowmap.js");

    const serverRoot = process.cwd();
    const repoRoot = path.resolve(serverRoot, "..");

    const diffResult = runGit(["diff", "--exit-code", "--", FLOWMAP_DIR], repoRoot);
    if (diffResult.status > 1) {
        console.error("[flowmap-drift] failed to run git diff");
        printGitFailureDetails(diffResult);
        process.exitCode = 1;
        return;
    }

    const untrackedResult = runGit(["ls-files", "--others", "--exclude-standard", FLOWMAP_DIR], repoRoot);
    if (untrackedResult.status !== 0) {
        console.error("[flowmap-drift] failed to list untracked files");
        printGitFailureDetails(untrackedResult);
        process.exitCode = 1;
        return;
    }

    const hasDiff = diffResult.status === 1;
    const untrackedFiles = untrackedResult.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    const hasUntracked = untrackedFiles.length > 0;

    if (!hasDiff && !hasUntracked) {
        console.log("[flowmap-drift] docs/flowmap is up to date");
        return;
    }

    console.error("[flowmap-drift] docs/flowmap drift detected");
    if (hasDiff) {
        console.error("[flowmap-drift] tracked file changes exist under docs/flowmap");
    }
    if (hasUntracked) {
        console.error("[flowmap-drift] untracked files:");
        for (const filename of untrackedFiles) {
            console.error(`  - ${filename}`);
        }
    }

    process.exitCode = 1;
}

await main();
