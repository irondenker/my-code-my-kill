function randomIntInclusive(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export type SimpleCaptchaChallenge = {
    question: string;
    answer: string;
};

/**
 * 학습/실습용 간이 캡챠(산술 문제)를 생성합니다.
 * 실서비스 보안 수준의 캡챠를 대체하지 않습니다.
 */
export function generateSimpleCaptchaChallenge(): SimpleCaptchaChallenge {
    const left = randomIntInclusive(1, 9);
    const right = randomIntInclusive(1, 9);
    const useSubtraction = Math.random() < 0.5;

    if (useSubtraction) {
        const larger = Math.max(left, right);
        const smaller = Math.min(left, right);
        return {
            question: `${larger} - ${smaller} = ?`,
            answer: String(larger - smaller),
        };
    }

    return {
        question: `${left} + ${right} = ?`,
        answer: String(left + right),
    };
}
