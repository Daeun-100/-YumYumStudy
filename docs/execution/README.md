# 병렬 구현 실행 안내

이 문서들은 실행 계획이다. 공통 기반 00을 구현했으며 실제 검사와 인계 사항은 [00 결과 보고](reports/00.md)에 기록한다. 나머지 기능은 구현 전이다. 모든 세션은 `AGENTS.md`, `docs/SPEC.md`, `docs/DECISIONS.md`, 이 문서, `CONTRACT.md`, 자신의 실행 문서를 읽는다. 구현 원칙은 최대한 간단하게이며 병렬화를 이유로 범용 프레임워크나 계층을 추가하지 않는다.

## 실행 순서

| 순서 | 문서 | 실행 조건 |
| --- | --- | --- |
| 먼저 1개 세션 | [00 공통 기반](00-foundation.md) | 구현됨. reports/00.md 확인 후 공통 커밋에서 분기 |
| 이후 병렬 A | [01 DB·서버 규칙](01-database.md) | 구현됨. reports/01.md에서 실제 검증과 인계 확인 |
| 이후 병렬 B | [02 내 타이머](02-timer.md) | 00 병합 후. DB 미완성 시 fixture로 개발 |
| 이후 병렬 C | [03 친구 현황](03-room.md) | 00 병합 후. DB 미완성 시 fixture로 개발 |
| 이후 병렬 D | [04 목표·기록](04-goals-history.md) | 목표 저장·출석 코어 준비됨. 화면 연결 가능 |
| 후속 | [05 출석·연차](05-attendance-leave.md) | 정책 확정 및 01 병합 후 |
| 마지막 1개 세션 | [06 통합·배포 검증](06-integration.md) | 01~04 병합 후. 05 미완료 시 전체 MVP 완료라고 하지 않음 |

00을 먼저 끝내야 import·패키지·라우터 충돌 없이 병렬 작업할 수 있다. 각 세션은 독립 worktree/브랜치(`codex/…`)를 사용하고 같은 체크아웃을 동시에 수정하지 않는다. 먼저 00까지의 공통 상태를 커밋하고 그 커밋에서 작업을 나눈다. 이 요청에서는 새 세션이나 worktree를 만들지 않는다.

## 파일 소유권

| 소유자 | 수정 가능한 주요 경로 |
| --- | --- |
| 00 | package.json, package-lock.json, app.json, index.ts, App.tsx, tsconfig.json, src/app/_layout.tsx, src/lib/supabase*, src/lib/identity*, src/lib/contracts.ts, src/lib/clock.ts, src/lib/study-day.ts, src/components/Screen.tsx, 테스트 실행 설정 |
| 01 | supabase/**, src/data/**, DB 통합 테스트 |
| 02 | src/screens/TodayScreen.tsx, src/hooks/useTimer.ts, src/app/index.tsx, tests/timer/** |
| 03 | src/screens/RoomScreen.tsx, src/hooks/useRoom.ts, src/app/room.tsx, tests/room/** |
| 04 | src/screens/GoalsScreen.tsx, src/screens/HistoryScreen.tsx, src/app/goals.tsx, src/app/history.tsx, tests/goals-history/** |
| 05 | src/screens/LeaveScreen.tsx, src/app/leave.tsx, supabase/migrations/200_*, tests/leave/** |
| 06 | 공통 통합 파일, CI, app.json, eas.json, public/**, 배포·검증 문서 |

01은 마이그레이션 이름을 `100_*`으로 시작해 05와 겹치지 않게 한다. 각 작업은 `docs/execution/reports/번호.md`에 결과를 기록한다. 타 세션 소유 파일·공통 계약·lockfile 수정이 필요하면 변경 요청을 보고서에 남기고 통합 담당자가 반영한다. 임시 타입을 서로 다른 이름으로 복제하지 않는다.

## 공통 완료 및 보고

- 린트·타입 검사, 담당 범위의 의미 있는 검사 실행. DB/실기기가 없으면 실제 검증과 fixture 검증을 구분한다.
- 보고서: 변경 파일, 구현한 계약, 실행한 검사와 결과, 남은 정책·외부 설정, 통합 시 주의점.
- fixture는 개발/검사 전용으로 명시하며 실제 실패를 가짜 성공 데이터로 대체하지 않는다.
- 원격 Supabase 생성·마이그레이션 적용·공개 배포는 로컬 구현 완료와 구분한다. 비밀키와 서명 키를 커밋하지 않는다.
- 다른 세션의 변경을 덮어쓰거나 정책 미정을 독단적으로 확정하지 않는다.

## 각 세션 공통 지시

아래 문장을 복사하고 번호별 문서 경로만 바꾼다.

> 이 레포의 AGENTS.md와 docs/execution/README.md, docs/execution/CONTRACT.md, docs/execution/02-timer.md를 읽고 해당 작업만 구현해줘. 선행 조건과 파일 소유권을 지키고 최대한 간단하게 구현해줘. 다른 세션 영역이나 공통 계약 변경이 필요하면 보고서에 남겨줘. 검증 결과와 미구현 사항을 docs/execution/reports/02.md에 기록해줘. 외부 서비스나 실기기 검증을 못 했다면 완료한 것처럼 쓰지 마.
