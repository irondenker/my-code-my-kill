import { getLabOptions, type SqlInjectionOptions } from "../../config/lab-options.js";
import { runWithSqlInjectionOption } from "../../utils/sql-injection.util.js";

/**
 * SQLi 실습 토글(전역 + 타깃) 제어 서비스입니다.
 *
 * 책임:
 * - `lab-options.json`의 SQLi 설정을 서비스 레이어에서 단일 진입점으로 제공합니다.
 * - 각 도메인 서비스는 config를 직접 읽지 않고 이 모듈을 통해 분기합니다.
 */

export type SqlInjectionTargetKey = keyof SqlInjectionOptions["targets"];

function getSqlInjectionOptions(): SqlInjectionOptions {
    return getLabOptions().sqlInjection;
}

/**
 * 특정 SQLi 타깃의 취약 모드 활성 여부를 반환합니다.
 */
export function isSqlInjectionTargetEnabled(target: SqlInjectionTargetKey): boolean {
    const sqlInjectionOptions = getSqlInjectionOptions();
    return sqlInjectionOptions.enabled && sqlInjectionOptions.targets[target];
}

/**
 * 특정 SQLi 타깃 기준으로 취약/안전 분기를 실행합니다.
 */
export async function runWithSqlInjectionTarget<T>(params: {
    target: SqlInjectionTargetKey;
    insecure: () => Promise<T>;
    safe: () => Promise<T>;
}): Promise<T> {
    const sqlInjectionOptions = getSqlInjectionOptions();
    return runWithSqlInjectionOption<T>({
        sqlInjectionOptions,
        targetEnabled: sqlInjectionOptions.targets[params.target],
        insecure: params.insecure,
        safe: params.safe,
    });
}
