# 페이지 전환 시 다크모드 깜빡임(FOUC) 정리

## 증상

- 페이지를 이동할 때 다크모드가 잠깐 풀렸다가 다시 적용되는 깜빡임이 간헐적으로 발생함

## 원인

- 기존 구조에서 테마 적용 스크립트(`color-modes.js`)가 `defer`로 로드되어, 첫 페인트 이후에 `data-bs-theme`가 바뀌는 타이밍 문제가 발생함
- 일부 페이지(예: 루트 랜딩)에서 `<html data-bs-theme="auto">`가 누락되어 초기 상태 일관성이 깨질 수 있음

## 해결 방법

1. `head`에 **초기 테마 적용 인라인 스크립트**를 넣어 첫 페인트 전에 `data-bs-theme`를 확정
2. 모든 주요 페이지의 `<html>`에서 `data-bs-theme` 속성을 일관되게 유지
3. `color-modes.js`에서 `localStorage.theme` 값 검증(`light|dark|auto`) 및 DOM null 가드 추가

## 적용 위치

- `server/views/partials/head.ejs`
  - CSP nonce를 포함한 인라인 스크립트로 초기 테마 즉시 적용
- `server/views/index.ejs`
  - `<html lang="ko" data-bs-theme="auto">`로 통일
- `server/public/assets/js/color-modes.js`
  - 저장된 테마값 검증 + 토글 DOM 안전 가드

## 참고

- 하단 `defer` 스크립트는 UI 토글 동작 유지용으로 두되, **초기 테마 확정은 head에서 먼저** 처리하는 것이 핵심
- 이 이슈는 네트워크/CPU 상태에 따라 재현 빈도가 달라져 “간헐적”으로 보일 수 있음
