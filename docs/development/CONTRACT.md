# 데이터 및 API 공통 계약

이 문서는 프로젝트 내부 인터페이스와 소비자가 지켜야 할 규칙을 정리한다. 타입은 `src/lib/contracts.ts`, 실제 함수는 `src/data/`가 기준이다. 계약을 변경하면 타입·응답 디코더·소비 화면을 함께 갱신한다. 기능의 기대 동작은 [상세 기능 정책](../product/FEATURE-POLICIES.md), 저장·복구·조회 구조는 [기술 설계](ARCHITECTURE.md)를 따른다.

## 데이터

| 타입 | 계약 |
| --- | --- |
| `UID` | 인증 UID 문자열. 표시 이름이나 요청에 담긴 UID로 소유권을 판정하지 않음 |
| `StudyDate` | `YYYY-MM-DD`, Asia/Seoul 오전 6시 기준 공부 날짜 |
| `Profile` | `id`, `displayName`, 선택 필드 `character`, `activeSkinId`, `skinUpdatedAt` |
| `StudySession` | `id`, `userId`, UTC ISO `startedAt`, UTC ISO 또는 null인 `endedAt` |
| `GoalWeek` | 월~일 7개 원소. 각 값은 정수 0~1,440분 또는 null. 0은 휴무, null은 미설정 |
| `DayRecord` | `studyDate`, `closedSeconds`, `runningSeconds`, `goalMinutes`, `attendance`, `isRestDay`, `goalAchieved`, 선택 boolean `superWatermelon` |
| `GoalSettings` | `current`, `scheduled`, `effectiveDate`, 선택 필드 `isFirstSetup` |
| `RoomMember` | `profile`, `today`, null 가능한 `activeSession` |
| `Snapshot<T>` | UTC ISO `serverNow`와 `data`. 같은 기준 시각의 일관된 조회 결과 |
| `LeaveGrant` | `id`, `status`, `scheduledDate`, `earnedAt`, 선택 필드 `approvedAt` 및 종류별 날짜 정보 |
| `LeaveStatus` | `revision`, `availableCount`, `grants`. 잔액은 AVAILABLE 건수 |

`attendance`는 present/absent/pending/leave다. 진행 중 포함 정수 초 합계 1초 이상이면 present이며 연차일은 leave가 우선한다. 양수 목표에서만 `goalAchieved`를 계산하고 휴무·미설정에서는 null이다. 0초인 현재·미래 날짜는 pending, 종료된 날짜는 absent다.

free/reward 연차는 `earningWeek`, `expiresAt`을 가진다. kind가 없는 구형 응답은 reward로 처리한다. admin은 `kind: admin`, `earningWeek: null`, `expiresAt: null`이며 일반 사용 잔액과 자동 선택에서 제외한다. 상태는 AVAILABLE/SCHEDULED/USED/EXPIRED 중 하나다.

오늘 표시 시간은 종료 합계와 현재 세션·오늘 구간이 겹치는 초를 더한다. 이때 snapshot의 `runningSeconds`를 다시 더하지 않는다. 과거 날짜의 미종료 부분은 `runningSeconds`로 잠정 표시하며 확정 시간에 저장하지 않는다. 서버 기준점과 monotonic 경과를 사용하고 표시 초는 음수가 되지 않게 내림한다.

## 인증과 시작 요청

`src/lib/identity.ts`의 `ensureAuthIdentity()`는 인증 UID, `ensureIdentity()`는 프로필, `ensureStudyIdentity()`는 시작·복구에 필요한 검증된 UID를 제공한다. UID 발급만으로 입장·프로필 준비 완료를 뜻하지 않는다. 화면은 공통 인증 상태를 재사용하며 SDK 클라이언트나 익명 인증 경로를 별도로 만들지 않는다.

동시 초기화는 같은 작업을 공유한다. 통신 오류와 세션 없음을 구분하고 기존 UID 표식이 있는데 인증이 없거나 다르면 새 UID를 자동 생성하지 않는다. 서버 권한 검사는 매 요청에서 유지한다.

`startStudy()`는 내부 UUID를 UID별 기기 저장 공간에 먼저 저장한 후 전송한다. 화면에서 요청 ID나 시작 RPC를 만들지 않는다. 실패·응답 유실은 같은 ID로 재시도하며 성공 응답의 소유자를 확인한 뒤 정리한다. 저장 실패·손상·정리 실패 시 임의의 새 ID로 대체하지 않는다.

`resumePendingStudyStart()`는 저장된 요청만 재전송하고 없으면 null이다. 초기 복구는 `StudyProvider`에서 처리하며, 복구 뒤 `getToday()`로 현재 상태를 조회한다. 원래 세션이 이미 종료됐을 수 있으므로 복구 응답만으로 실행 중이라고 표시하지 않는다. 여러 웹 탭의 저장소 원자적 잠금은 제공하지 않으며 서버의 진행 세션 유일성으로 중복 진행을 막는다. 앱·저장소 삭제 후 요청 복원은 보장하지 않는다.

서버는 같은 request ID에 원래 세션을 반환한다. 다른 요청이 기존 진행 세션을 재사용했어도 요청 매핑을 보존해 늦은 재전송이 새 공부를 만들지 않게 한다. 직접 중지는 최초 승인 종료 시각을 유지한다. Android 이탈 중지는 별도 저장된 이탈 시각과 RPC 계약을 따른다.

## 공부·목표·기록 함수

`src/data/study.ts`의 주요 함수:

```ts
getToday(): Promise<Snapshot<TodayData>>
startStudy(): Promise<Snapshot<StudySession>>
resumePendingStudyStart(): Promise<Snapshot<StudySession> | null>
stopStudy(sessionId: string): Promise<Snapshot<StudySession>>
getRoom(): Promise<Snapshot<RoomMember[]>>
getGoals(): Promise<GoalWeek>
getGoalSettings(): Promise<Snapshot<GoalSettings>>
saveGoals(goals: GoalWeek): Promise<Snapshot<{ effectiveDate: string; goals: GoalWeek }>>
getHistory(from: StudyDate, to: StudyDate): Promise<Snapshot<DayRecord[]>>
getMemberHistory(memberId: string, from: StudyDate, to: StudyDate): Promise<Snapshot<DayRecord[]>>
subscribeStudyChanges(onChange: () => void, onState: (state: ConnectionState) => void): () => void
```

인증된 사용자와 현재 방을 기준으로 조회·변경한다. 친구 기록은 동일 방·입장 완료 권한을 서버에서 검증한다. 기록 API의 한 요청은 최대 366일이며 UI는 주·월별 범위를 바꿔 이전 기간을 조회한다. 상세 세션은 별도 조회로 처리한다.

목표 최초 저장은 목표 이력이 없는 경우 현재 공부 날짜부터 적용하고, 이후 변경은 다음 공부 날짜에 예약한다. 미설정 값만 있는 이력도 이력으로 취급한다. 프로필 잠금 후의 서버 시각으로 판정하고 현재·과거 버전은 보존한다. 저장 응답의 실제 적용 날짜로 안내한다.

편집 화면은 저장 직전 최신 예약 주간(없으면 현재 주간)을 조회해 수정한 요일만 병합한다. 다른 요일의 null·휴무·분 단위 값은 보존하고 실패 시 초안을 유지한다. 이는 조회 기준 병합이며 동시 목표 저장의 새 버전 잠금은 아니다. 여러 기기의 같은 목표 저장은 서버의 마지막 저장을 따른다.

## 연차 변경과 갱신

`src/data/leave.ts`:

```ts
getLeaveStatus(): Promise<Snapshot<LeaveStatus>>
scheduleLeave(date: string, revision: number, grantId: string | null = null): Promise<Snapshot<LeaveStatus>>
cancelLeave(grantId: string, date: string, revision: number): Promise<Snapshot<LeaveStatus>>
resumePendingLeave(): Promise<Snapshot<LeaveStatus> | null>
```

`getLeaveStatus`는 본인 프로필 잠금 아래 누락 지급을 보충하므로 원시 테이블 조회로 대체하지 않는다. 획득 시각·고정 만료를 보존하고 매초 호출하지 않는다. AVAILABLE만 잔액에 포함하며 예약은 사용일 06:00부터 USED, 당일 신청은 승인 즉시 USED다. USED는 만료 이후에도 유지하고 미예약 건은 만료 정각부터 EXPIRED다.

변경은 `mutate_leave`로 통일하고 내부 unversioned RPC는 앱에 직접 공개하지 않는다. 다음 규칙을 지킨다.

- API 계층은 미확인 ID·입력을 UID별 기기에 먼저 저장한다. 재시도·재실행은 같은 ID·입력을 쓰며 다른 미확인 요청을 덮지 않는다.
- 같은 ID·입력은 재실행하지 않고 현재 스냅샷을 반환한다. 같은 ID의 다른 입력, 최신 revision과 다른 새 요청은 거부한다. 성공한 변경은 revision을 증가시킨다.
- 명확한 VALIDATION 거절은 대기를 정리하고 통신·인증 등 불확실한 실패는 보존한다. 응답 유실 후에도 신규 요청으로 중복 차감하지 않는다.
- grant ID 생략 시 사용일에 유효한 AVAILABLE을 만료·획득 시각·ID 순으로 고른다. 미래 예약 날짜 변경은 기존 지급분을 유지하고 실패 시 기존 예약을 보존한다. 관리자 연차는 자동 선택·사용자 변경 대상이 아니다.
- 당일 사용·보상 보호·06:00 경계는 상세 정책을 따른다. 잠금 대기 후의 실제 시각으로 검증하고 사용자·날짜별 하나만 보장한다.
- `LeaveProvider`는 시작·복귀·웹 온라인·공부 날짜 전환·목표 도달·사용·만료 경계에 갱신한다. 오류를 보존해 다음 정상 공부 조회 시 재시도하고 공부 타이머를 실패시키지 않는다. 성공 응답의 연차 상태와 공부 현황을 함께 갱신한다.

## 구독·오류·화면 연결

- 구독 준비 완료·재연결·변경 알림 후 authoritative snapshot을 조회한다. 조회 중 알림은 후속 조회로 유실을 막고 구독을 정리한다.
- `connected`는 소켓 SUBSCRIBED만이 아니라 system 이벤트의 `postgres_changes` 준비 완료(ok)를 확인한 상태다. 연결 상태는 해당 구독에 대한 것이며 친구의 접속 여부나 모든 데이터의 최신성을 보장하지 않는다.
- 실시간 변경은 같은 방 세션과 프로필을 포함한다. 표시용 초 시계는 로컬에서 계산하고 매초 DB 읽기·쓰기를 하지 않는다. 최신 화면별 수요·보조 조회 설계는 관련 코드와 갱신 설계 문서에서 확인한다.
- 라우트는 `src/app/`에 두고 화면·상태 로직은 `src/features/` 등 라우트 밖에서 관리한다. 현재 없는 초기 화면 이름이나 과거 작업 번호에 맞춰 구조를 되돌리지 않는다.
- 오류는 `StudyError`로 전달한다. code는 NETWORK / UNAUTHORIZED / VALIDATION / POLICY_PENDING / NOT_CONFIGURED / UNKNOWN이며 한국어 안내를 제공한다. 실패·잘못된 응답을 빈 배열·0초·저장 성공으로 숨기지 않는다.

## 슈퍼 수박 서버 판정

`superWatermelon`은 서버가 확정한 일요일 완주 표식이다. 구형 서버에서 필드가 생략되면 금색 수박을 추정하지 않는다. 클라이언트는 양수 목표·공부 시간을 유지하고 주간·월간·친구 기록 및 프로필 표시까지 이 필드를 전달한다. 일요일 표식의 변경은 기록 쿼리 버전을 갱신한다.

`super_watermelon_awards`는 사용자와 획득 주의 고유 키를 가진 비공개 표식이며 클라이언트 직접 조회·쓰기를 허용하지 않는다. `get_today`, `get_history`, `get_member_history`가 기존 입장·방 권한을 검증하고 대상 프로필을 잠근 뒤 조회 범위의 누락 지급을 복구한다. 월 경계의 부분 조회도 전체 7일을 검사한다. 기존 내부 함수·래퍼는 클라이언트 실행 권한을 회수한다.

적용 파일: `supabase/migrations/20261029063647_super_watermelon_rewards.sql`. SQL 회귀 검증: `supabase/tests/super_watermelon.sql`, `same_day_leave.sql`, `leave_attendance_policy.sql`, `admin_leave.sql`.
