import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runTsxInlineScript(params: {
    script: string;
    env?: Record<string, string>;
}): Promise<{ stdout: string; stderr: string }> {
    const { stdout, stderr } = await execFileAsync(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", params.script],
        {
            cwd: process.cwd(),
            env: {
                ...process.env,
                ...params.env,
            },
            maxBuffer: 10 * 1024 * 1024,
        },
    );
    return { stdout, stderr };
}

