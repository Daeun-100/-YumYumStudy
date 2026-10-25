# 00 — 공통 기반 (먼저 실행)

목표: 다른 세션들이 같은 import와 실행 환경에서 개발하도록 최소 기반을 준비한다.

## 작업

1. 현재 Expo SDK를 확인하고 AGENTS.md에 따른 공식 문서를 읽는다. SDK 호환 Expo Router, Supabase JS, 세션 영속 저장에 필요한 패키지만 설치한다.
2. Expo Router 진입점과 `src/app/_layout.tsx`, 임시 `src/app/index.tsx`를 구성한다. 기존 시작 화면을 대체하되 타이머 구현은 하지 않는다. 00 이후 index.tsx 소유권은 02로 넘긴다.
3. `src/lib/contracts.ts`에 공통 타입·StudyError를 정의한다. CONTRACT.md와 시그니처를 맞춘다.
4. 환경 변수 검증을 포함한 Supabase 클라이언트와 플랫폼별 세션 저장을 구성한다. 설정 누락 시 설명과 재시도를 표시하고 가짜 UID를 만들지 않는다.
5. ensureIdentity와 단일 초기화 흐름을 작성한다. 01 미완료 시 프로필 확보는 명시적인 미연결 오류로 처리한다. 프로필 저장은 `src/data/profile.ts`의 `ensureProfile(): Promise<Profile>` 경계를 통해 호출한다.
6. `src/data/study.ts`에 공통 계약의 exported 함수만 선언하고 실제 연결 전에는 NOT_CONFIGURED/POLICY_PENDING 오류를 낸다. 이 파일은 이후 01만 수정한다.
7. `src/lib/study-day.ts`, `src/lib/clock.ts`에 6시 날짜·구간 겹침·서버 기준 경과 계산을 구현한다. 화면과 SQL이 같은 예제로 검증되게 한다.
8. 필요한 경우 최소 테스트 실행 도구 하나만 설정한다. 테스트 도구 변경은 이후 세션이 반복하지 않게 README 명령을 기록한다.

## 완료 기준

- 환경 변수 없이도 오류 안내 화면이 렌더링되고 프로세스가 죽지 않는다.
- 기존 익명 세션 복원 시 UID를 재발급하지 않는다. 일시 오류에서 새 사용자를 만들지 않는다.
- 05:59:59/06:00:00, 여러 날 세션, 음수 표시 방지의 계산을 검사한다.
- `npm run lint`, `npm run typecheck`, `npm run export:web` 통과.
- 보고서 `reports/00.md`에 의존성, 실제 생성 파일, 테스트 실행법, 01의 연결 필요 지점을 적는다. 이후 세션은 이 공통 커밋에서 분기한다.

범위 밖: 실제 DB 마이그레이션, 타이머 UI, 목표 정책 확정, 원격 배포.
