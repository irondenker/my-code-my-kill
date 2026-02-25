# 일일 보고 (2026-02-25)

## 금일 작업 내용

이전 CSP 관련 학습의 심화 차원으로, 관련 취약점에 대해 학습하고 조치한 내용에 대해 정리하여 보고합니다.
금일 학습 및 조치는 브라우저의 정책 측면이라, 모의해킹 기술 수련과 직접적인 연관이 없는 내용은 맞습니다.
다만 Client-Side에서의 XSS 차단 효과 / 파일 타입을 검증하는 MIME 개념을 두루 다루고 있는 내용이라, 학습 과정이 업무에 큰 도움이 될 것 같아 금일 작업으로 채택해 수행했습니다. 아울러,  `unsafe-inline`/`unsafe-eval`의 경우 이전 업무 중 취약점 리뷰 회의에서 언급되었던 단어라, 언젠가는 해당 키워드의 의미와 위험성에 대해 금일 작업을 통해 깊게 짚고 넘어가고 싶었던 것도 결정 이유입니다.

## 금일 산출 문서 (상세)

- [`Swagger CDN 의존 제거 및 로컬 서빙 전환`](../../learn/swagger-cdn-to-local-serving.md)
- [`CSP 인라인/unsafe-eval 제거 및 삽입 위치별 방어`](../../learn/csp-inline-eval-hardening.md)
- [`nosniff` 적용과 MIME 스니핑 위험/한계 정리](../../learn/nosniff-mime-sniffing.md)
- [`nginx 직접 응답 경로 보안 헤더 일관화`](../../learn/nginx-header-consistency.md)
- [`SRI 무결성 검증`](../../learn/appendix-sri-integrity.md)
