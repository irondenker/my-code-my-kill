/**
 * SQLi 실습 옵션 분기 유틸입니다.
 *
 * 목적:
 * - 여러 서비스에서 반복되는 "취약 쿼리 / 안전 쿼리" 선택 로직을 공통화합니다.
 * - 컨텍스트별 타깃 플래그(targetEnabled)와 전역 스위치(enabled)를 함께 적용합니다.
 */

export type SqlInjectionSwitch = {
    enabled: boolean;
};

/**
 * SQLi 실습 옵션에 따라 (취약 쿼리 / 안전 쿼리) 중 하나를 선택 실행합니다.
 *
 * 규칙:
 * - 전역 스위치(enabled)와 개별 타깃(targetEnabled)이 모두 true일 때만 취약 쿼리를 사용합니다.
 * - 기본은 안전 쿼리입니다.
 *
 * @param params.sqlInjectionOptions 전역 스위치가 포함된 옵션 객체
 * @param params.targetEnabled 개별 타깃 활성화 여부
 * @param params.insecure 취약 쿼리(문자열 보간) 실행 함수
 * @param params.safe 안전 쿼리(바인딩) 실행 함수
 */
export async function runWithSqlInjectionOption<T>(params: {
    sqlInjectionOptions: SqlInjectionSwitch;
    targetEnabled: boolean;
    insecure: () => Promise<T>;
    safe: () => Promise<T>;
}): Promise<T> {
    if (params.sqlInjectionOptions.enabled && params.targetEnabled) {
        return params.insecure();
    }
    return params.safe();
}

