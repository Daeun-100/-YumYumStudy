# 목표 저장·출석 코어 결과

2026-10-26. 화면 작업 없이 확정 정책을 서버와 공통 계산 함수에 구현했다.

## 규칙과 API

- 목표: 월~일 7개, 정수 0~1,440분 또는 null. 0분은 휴무, null은 미설정이다.
- saveGoals: 인증 UID의 다음 공부 날짜에만 예약한다. 프로필 행 잠금 후 서버 시각을 읽으므로 잠금 대기 중 6시를 지나도 그 시점의 다음 날짜를 적용한다. 같은 적용일 재저장은 하나의 버전을 갱신한다. 현재·과거 목표는 건드리지 않는다.
- getGoals: 현재 적용 목표만 반환한다. getGoalSettings: serverNow와 current/scheduled/effectiveDate를 함께 반환한다. 저장 화면은 예약 목표를 현재 적용 목표와 구분한다.
- 출석: closedSeconds + runningSeconds가 1 이상이면 present. 현재·미래 날짜에 0초면 pending, 날짜가 종료된 뒤에도 0초면 absent다.
- isRestDay는 목표 0분 여부로 별도 표시한다. 쉬는 날 공부해도 present다. absent는 공부 없음 사실만 의미하며 휴무일 불이익을 구현하지 않는다.
- goalAchieved는 양수 목표에서만 계산한다. 휴무·미설정은 null이며 자동 달성/0으로 나누기를 만들지 않는다.
- day-status.ts의 deriveDayStatus는 화면에서 서버 기준 시계와 현재 시간을 이용해 같은 규칙을 계산할 수 있게 한다. 새로운 UI는 추가하지 않았다.

## 변경

- 110_goals_attendance.sql: 목표 상한 제약, save_goals/get_goal_settings RPC, 출석/휴무/목표 달성 계산.
- 111_empty_day_running_time.sql: 빈 LEFT JOIN 행을 진행 중 세션으로 합산하지 않도록 수정. 실제 경계 검사 중 발견했으며 세션이 없는 날짜의 runningSeconds가 반드시 0인지 회귀 검사를 추가했다. 110을 이미 적용했으므로 교정 이력을 별도 마이그레이션으로 남겼다.
- contracts.ts / decode.ts / study.ts: 새 상태와 예약 목표 응답, 실제 저장 연결. 목표 저장은 더 이상 POLICY_PENDING이 아니다.
- Realtime: 단순 SUBSCRIBED 대신 system 이벤트의 extension=postgres_changes, status=ok를 받아야 connected로 표시한다. 공식 문제 해결 문서의 준비 완료 절차를 따른다.

## 검증

- 자동 테스트 20개 통과. 출석 0/1초, 진행 중 포함, 휴무/미설정 구분, 목표 미달과 출석 분리, 목표 달성 경계, 6시 상태 전환, 목표 0/1440/초과/소수/음수 및 예약 응답 검증.
- 타입 검사·린트·웹 export 통과.
- 실제 Supabase에 110과 111 적용 완료. 같은 프로젝트에서 중복 실행하지 않는다.
- 실제 API 검사: 다음 공부 날짜 저장, 현재 목표 유지, 반복 저장 버전 1개, 다른 사용자의 예약 목표와 격리, 잘못된 입력 거부, 무인증/직접 테이블 쓰기 차단 통과.
- 타이머 동시 시작·중복 종료·지연 재전송·오늘/기록 일치 회귀 검사 통과.
- 첫 회귀 검사에서 Realtime은 소켓 구독 후 DB 수신 준비 전에 기록이 변경돼 알림을 놓쳤다. 준비 완료 이벤트를 기다리도록 보완한 뒤 실제 INSERT/UPDATE 수신 검사 통과.
- 실제 SQL 검사: 목표 예약/현재 보존, 중복 저장, 목표 상한, 빈 날짜 0초, 0.999초 미인정/1초 인정, 휴무일 진행 중 출석, 과거/미래/6시 경계 통과. 임시 변경은 rollback했다.
- 로컬 Docker 및 Android/iPhone 실기기 검증은 수행하지 않았다. UI도 사용자 요청대로 후속 단계다.

## 테스트 데이터 및 후속 작업

이 단계의 API 검사를 두 번 실행해 테스트 익명 사용자 4명이 추가됐다. 기존 4명을 포함해 study_core_test 표시 계정은 총 8명이다. 인증 토큰은 저장/출력하지 않았고 테스트 세션은 모두 종료했다. 테스트 계정은 삭제하지 않았다.

- 첫 검사: 7eca4535-3996-4998-b6ee-7d048029e741, 724b07da-96f5-4106-b69e-99a2be7f5e5a
- 최종 API 검사: 93eba086-791a-497d-97d3-b08b25562cf2, 3c45e206-759a-4768-b067-00ed321554a8

연차 지급/사용/취소/만료와 출석 대체 규칙은 여전히 미정이다. 목표/기록 화면은 공통 계약 v4에 맞춰 연결하면 된다. 과거 00/01 보고서의 pending/POLICY_PENDING 설명은 당시 상태다.

참고: https://supabase.com/kb/troubleshooting/realtime-postgres-changes-troubleshooting
