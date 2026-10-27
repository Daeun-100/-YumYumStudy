# 세션 간 공통 계약 v6

00이 아래 계약을 `src/lib/contracts.ts`에 타입으로 작성한다. 01~04는 이를 그대로 사용한다. SDK API 문서가 아니라 이 프로젝트의 내부 인터페이스 설계다. 변경이 필요하면 통합 담당자가 계약과 소비자를 함께 변경한다.

## 데이터

- `UID = string`: Supabase 인증 UID. 표시 이름·클라이언트 요청 UID로 소유권을 결정하지 않는다.
- `StudyDate = string`: `YYYY-MM-DD`, Asia/Seoul 오전 6시 기준.
- `StudySession`: `id`, `userId`, `startedAt`(ISO UTC), `endedAt`(ISO UTC 또는 null).
- `Profile`: `id`(UID), `displayName`. 고정 방 하나만 사용하며 UI에는 방 ID를 받지 않는다.
- `GoalWeek`: 월요일부터 일요일까지 7개 원소. 각 원소는 0~1,440분 정수 또는 null(미설정). 0분=휴무. 최초 저장은 오늘부터, 이후 저장은 다음 공부 날짜 오전 6시부터 적용한다.
- `DayRecord`: studyDate, closedSeconds, runningSeconds, goalMinutes, attendance(present/absent/pending), isRestDay(boolean), goalAchieved(boolean 또는 null). 진행 중 포함 1초 이상 present, 현재/미래 0초 pending, 종료된 날짜 0초 absent. 휴무는 goalMinutes=0이고 목표 달성은 양수 목표에만 계산한다.
- `GoalSettings`: current(현재 GoalWeek), scheduled(예약 GoalWeek 또는 null), effectiveDate(예약 적용 공부 날짜 또는 null).
- `LeaveGrant`: id, earningWeek(월요일 공부 날짜), earnedAt(실제 6번째 달성 시각), expiresAt(획득 주 월요일 06:00+21일).
- `LeaveStatus`: availableCount(현재는 미만료 지급 건수), grants(만료 포함 지급 내역, 획득 주 내림차순). 사용 기능 추가 시 잔액 계산도 함께 확장한다.
- `RoomMember`: `profile`, `today`(DayRecord), `activeSession`(null 가능).
- `Snapshot<T>`: `serverNow`(ISO UTC), `data`(T). snapshot 전체는 한 기준 시각의 일관된 데이터여야 한다.

진행 중 오늘 시간 = closedSeconds + 현재 세션과 오늘 공부 날짜 구간이 겹치는 초. 여러 날 지속된 세션을 전부 오늘 합계에 더하지 않는다. 표시 초는 음수가 되지 않게 내림한다. 서버 시간과 로컬 monotonic 경과를 기준으로 표시하고 재조회 시 기준을 갱신한다. 로컬 시계 변경이 확정 기록을 바꾸지 않는다.

01 보완: 기록 화면은 `runningSeconds`를 잠정 시간으로 별도 표시해 오래 켜둔 세션의 과거 날짜 부분도 볼 수 있다. 오늘/친구 화면에서 activeSession으로 실시간 겹침을 계산할 때는 runningSeconds를 다시 더하지 않는다. 이 값은 `serverNow` 시점의 snapshot이며 확정 시간으로 저장하지 않는다. 기록 범위는 최대 366일이고 서버는 최신 공부 날짜부터 반환한다.

## 클라이언트 함수

`src/lib/identity.ts` (00 담당):

```ts
ensureIdentity(): Promise<Profile>
```

세션 복원 → 없으면 익명 인증 → 고정 방 프로필 확보. 동시 호출은 같은 진행 중 Promise를 재사용한다. 통신 실패와 세션 없음을 구분한다. 인증 세션 저장은 플랫폼 어댑터에 맡긴다.

00 구현: 화면은 `useIdentity()`로 loading/uid/profile/error/retry를 받는다. UID 발급만 확인할 때 `ensureAuthIdentity(): Promise<UID>`를 사용할 수 있지만 고정 방 준비 완료를 의미하지 않는다. 프로필 작업이 끝나야 ensureIdentity가 성공한다. 01은 `ensureProfile()`을 구현하며 인증 로직을 별도로 복제하지 않는다. 저장된 UID 표식이 있는데 인증 세션이 없거나 UID가 바뀌면 자동으로 새 UID를 생성하지 않는다.

`src/data/study.ts` (00은 시그니처와 명시적인 미연결 오류만, 01이 구현):

```ts
getToday(): Promise<Snapshot<{ profile: Profile; day: DayRecord; activeSession: StudySession | null }>>
startStudy(): Promise<Snapshot<StudySession>>
resumePendingStudyStart(): Promise<Snapshot<StudySession> | null>
stopStudy(sessionId: string): Promise<Snapshot<StudySession>>
getRoom(): Promise<Snapshot<RoomMember[]>>
getGoals(): Promise<GoalWeek>
getGoalSettings(): Promise<Snapshot<GoalSettings>>
saveGoals(goals: GoalWeek): Promise<Snapshot<{ effectiveDate: StudyDate; goals: GoalWeek }>>
getHistory(from: StudyDate, to: StudyDate): Promise<Snapshot<DayRecord[]>>
subscribeStudyChanges(onChange: () => void, onState: (state: 'connecting' | 'connected' | 'disconnected') => void): () => void
```

모든 조회·구독은 인증된 세션을 사용한다. 사용자 인자가 없는 변경 작업은 본인에 한정한다. 구독은 고정 방의 세션 변경 알림을 다룬다.

startStudy는 내부에서 UUID를 생성해 UID별 기기 저장 공간에 먼저 보관한 후 전송한다. 화면에서 requestId를 만들거나 직접 RPC를 호출하지 않는다. 실패 시 같은 번호를 보존하고 재시도한다. 한 JS 실행 환경의 동시 호출은 같은 Promise를 공유한다. 성공 응답의 UID를 확인한 뒤 저장된 번호를 정리한다. 저장 실패·손상은 새 번호로 덮어쓰지 않고 오류로 표시한다.

resumePendingStudyStart는 저장된 요청만 재전송하고, 없으면 null을 반환하며 공부를 새로 시작하지 않는다. IdentityProvider가 앱 초기화 및 초기화 재시도 때 호출한다. 화면 복원은 이후 getToday로 최신 상태를 조회한다. 서버가 이미 종료된 원래 세션을 반환할 수도 있으므로 복구 응답만 보고 진행 중이라고 표시하지 않는다. 저장은 네이티브 AsyncStorage, 웹 localStorage를 사용하며 저장 공간 삭제·앱 삭제 이후에는 보존을 보장하지 않는다. 여러 탭 사이의 원자적 잠금은 구현하지 않으며 서버의 사용자별 진행 세션 유일성으로 중복 진행을 막는다.

서버는 requestId 재전송에 원래 세션을 반환한다. 이미 진행 중인 세션이 있으면 새로 만들지 않고 그 세션을 반환한다. stopStudy는 세션 ID로 중복 처리를 막고 최초 DB 승인 종료 시각을 보존한다. 응답 유실 후 재전송으로 종료 시각을 바꾸지 않는다.

각 함수는 실패 시 `StudyError`를 throw한다. `code`는 `NETWORK | UNAUTHORIZED | VALIDATION | POLICY_PENDING | NOT_CONFIGURED | UNKNOWN`, `message`는 사용자에게 표시 가능한 한국어다. 실패를 빈 배열·0초로 숨기지 않는다. 프로필 초기화 RPC 이름과 SQL 매개변수는 01이 확정하고 00의 identity 연결부를 변경해야 할 경우 보고한다. 00은 identity에서 호출하는 초기화 함수를 별도 `src/data/profile.ts`로 선언하고 01이 구현한다.

## 구독과 화면

- 구독 연결 완료 후 snapshot 조회, 변경 알림마다 재조회한다. 조회 중 알림이 오면 마지막 조회 후 다시 확인해 갱신을 유실하지 않는다.
- connected는 소켓의 SUBSCRIBED가 아니라 서버 system 이벤트의 postgres_changes 준비 완료(ok)를 확인한 상태다. src/data/study.ts가 이를 처리한다.
- 복귀·재연결 시 DB를 재조회하고 중복 구독을 정리한다. 메시지 도착 순서로 확정 시간을 계산하지 않는다.
- 별도 초 단위 DB 쓰기, 자체 WebSocket 서버, UI heartbeat를 추가하지 않는다. 현재 연결 상태만 표시한다. 구성원별 온라인 여부는 초기 병렬 구현 범위에서 보류한다.
- 화면은 named export로 `TodayScreen`, `RoomScreen`, `GoalsScreen`, `HistoryScreen`을 제공한다. 라우트 파일은 해당 화면을 default export하는 얇은 연결부다.
- 00이 `_layout.tsx`에 현재 존재하는 라우트만 연결한다. 06이 완성된 화면들을 내비게이션으로 묶는다.

## 목표·출석과 남은 정책

목표 저장과 출석 코어는 110 마이그레이션으로 구현했다. getGoals는 현재 적용된 목표만 반환한다. 편집 화면은 getGoalSettings로 예약 목표와 적용 날짜를 확인한다. 270 마이그레이션에서 최초 목표 이력이 없는 계정은 현재 공부 날짜부터 적용한다. 이후 saveGoals는 다음 공부 날짜에만 upsert하고 현재·과거 목표를 수정하지 않는다.

화면 타이머가 1초/목표 시간에 도달하거나 6시를 지날 때 표시를 갱신하려면 src/lib/day-status.ts의 deriveDayStatus를 서버 기준 시계와 해당 날짜의 정수 초 합계에 적용한다. snapshot의 runningSeconds와 activeSession 계산을 중복 합산하지 않는다.

`src/data/leave.ts`: getLeaveStatus(): Promise<Snapshot<LeaveStatus>>. 본인 UID는 서버 인증에서만 확인하고 인자로 받지 않는다. 조회 시 누락된 획득분을 저장하므로 원시 테이블 조회로 대체하지 않는다. 클라이언트 호출 시각이 아닌 실제 6번째 목표 달성 시각을 보존한다. 목표 달성 중인 세션도 포함하며 0분·미설정은 제외한다. 서버 시각이 expiresAt 정각 이상이면 잔액에서 제외한다. 향후 연차 화면 진입·복귀 및 목표 달성 시 호출해야 하며, 현재 타이머/연차 UI는 없다.

210 마이그레이션부터 각 grant는 status와 scheduledDate를 반환한다. status는 AVAILABLE/SCHEDULED/USED/EXPIRED 중 하나이며 availableCount는 AVAILABLE 건수다. scheduleLeave(grantId, date), cancelLeave(grantId, date)는 갱신된 Snapshot<LeaveStatus>를 반환한다. 예약은 미래 공부 날짜의 06:00이 만료 전일 때만 허용하고, 취소는 사용일 06:00 전까지만 허용한다. 220부터 출석은 leave를 지원한다. 연차일은 주간 지급 계산에서 제외하며 날짜당 1개만 예약할 수 있다. 실제 공부 시간과 goalAchieved는 보존한다. 210은 원격 적용 및 실제 DB 롤백 테스트를 완료했다. 사용자 요청으로 연차 UI는 보류한다. 과거 보고서의 POLICY_PENDING은 당시 구현 상태이며 현재 목표 저장에는 적용되지 않는다.


### 230 연차 요청·자동 갱신 계약

230 원격 적용 완료. LeaveStatus에 revision(예약/취소 버전)이 추가된다. 이전 unversioned schedule_leave/cancel_leave는 내부용으로만 유지하며 authenticated 실행 권한을 철회했다.

- scheduleLeave(date, revision, grantId = null): grantId 생략 시 사용일까지 유효한 AVAILABLE 중 expiresAt/earnedAt/id 순으로 선택한다.
- cancelLeave(grantId, date, revision): 최신 조회의 revision으로 취소한다.
- API 계층은 UID별 미확인 요청을 기기에 먼저 저장한다. 재시도/재실행은 같은 request ID와 입력으로 진행한다. 확인되지 않은 다른 요청을 덮어쓰지 않는다. 명확한 VALIDATION 거절은 대기 요청을 정리하고, 통신/인증 등 불확실한 실패는 보존한다.
- mutate_leave(request ID, revision, action, date, optional grant ID)는 동일 ID/입력 재전송을 재실행하지 않고 현재 스냅샷을 반환한다. 같은 ID의 다른 입력 및 최신 예약 버전과 다른 새 요청은 거절한다. 성공한 변경은 버전을 증가시킨다.
- LeaveProvider는 앱 시작/복귀, 웹 연결 복구, 공부 날짜 전환, 목표 도달, 연차 사용/만료 경계에서 갱신한다. useLeave()는 snapshot/error/refresh를 제공한다. 향후 UI는 mutation 반환 스냅샷을 사용하거나 refresh()를 호출한다.
- 타이머 매초 tick은 로컬 판정에만 사용한다. 연차 RPC를 매초 호출하지 않는다. 오류는 별도 상태로 보존해 공부 타이머 요청을 실패시키지 않는다.
- 연차 화면은 추가하지 않았다. 실제 기기의 백그라운드/복귀 E2E 검증은 별도다.


### 목표 설정 화면·조회 복구 보완

- saveGoals는 서버가 확정한 적용 날짜와 저장한 목표를 반환한다. 화면은 서버 응답 날짜로 최초 즉시 적용과 다음 공부 날짜 예약을 구분한다. getGoalSettings는 isFirstSetup을 반환한다.
- 목표 화면은 저장 직전 최신 예약 주간(없으면 현재 주간)을 조회해 수정한 요일만 병합한다. 실패 시 선택값을 보존하고 재시도한다. 여러 기기의 동시 목표 저장은 기존 서버의 마지막 저장 우선 정책이며 목표 편집 버전 잠금은 추가하지 않았다.
- 공부 조회는 Realtime connected 및 웹 online 이벤트에서도 수행한다. 연차 조회 실패는 이후 정상 공부 스냅샷 수신 시 재시도하며 매초 폴링하지 않는다.
