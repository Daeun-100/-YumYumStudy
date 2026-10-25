# 세션 간 공통 계약 v1

00이 아래 계약을 `src/lib/contracts.ts`에 타입으로 작성한다. 01~04는 이를 그대로 사용한다. SDK API 문서가 아니라 이 프로젝트의 내부 인터페이스 설계다. 변경이 필요하면 통합 담당자가 계약과 소비자를 함께 변경한다.

## 데이터

- `UID = string`: Supabase 인증 UID. 표시 이름·클라이언트 요청 UID로 소유권을 결정하지 않는다.
- `StudyDate = string`: `YYYY-MM-DD`, Asia/Seoul 오전 6시 기준.
- `StudySession`: `id`, `userId`, `startedAt`(ISO UTC), `endedAt`(ISO UTC 또는 null).
- `Profile`: `id`(UID), `displayName`. 고정 방 하나만 사용하며 UI에는 방 ID를 받지 않는다.
- `GoalWeek`: 월요일부터 일요일까지 순서인 7개 원소의 배열. 각 원소는 정수 분 또는 null(미설정). 정확히 7개인지 런타임 검증한다. 0분 허용·변경 적용 시점은 정책 확정 전 저장 불가.
- `DayRecord`: `studyDate`, `closedSeconds`(종료 세션만 날짜별 분할 합산), `goalMinutes`(null 가능), `attendance`(`pending` 또는 확정 정책에 따른 값). 정책 미확정 상태를 결석으로 표시하지 않는다.
- `RoomMember`: `profile`, `today`(DayRecord), `activeSession`(null 가능).
- `Snapshot<T>`: `serverNow`(ISO UTC), `data`(T). snapshot 전체는 한 기준 시각의 일관된 데이터여야 한다.

진행 중 오늘 시간 = closedSeconds + 현재 세션과 오늘 공부 날짜 구간이 겹치는 초. 여러 날 지속된 세션을 전부 오늘 합계에 더하지 않는다. 표시 초는 음수가 되지 않게 내림한다. 서버 시간과 로컬 monotonic 경과를 기준으로 표시하고 재조회 시 기준을 갱신한다. 로컬 시계 변경이 확정 기록을 바꾸지 않는다.

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
startStudy(requestId: string): Promise<Snapshot<StudySession>>
stopStudy(sessionId: string): Promise<Snapshot<StudySession>>
getRoom(): Promise<Snapshot<RoomMember[]>>
getGoals(): Promise<GoalWeek>
saveGoals(goals: GoalWeek): Promise<void>
getHistory(from: StudyDate, to: StudyDate): Promise<Snapshot<DayRecord[]>>
subscribeStudyChanges(onChange: () => void, onState: (state: 'connecting' | 'connected' | 'disconnected') => void): () => void
```

모든 조회·구독은 인증된 세션을 사용한다. 사용자 인자가 없는 변경 작업은 본인에 한정한다. 구독은 고정 방의 세션 변경 알림을 다룬다.

startStudy는 클라이언트에서 생성한 UUID인 requestId로 중복 요청을 처리하고 재전송에는 원래 세션을 반환한다. 이미 진행 중인 세션이 있으면 새로 만들지 않고 그 세션을 반환한다. stopStudy는 세션 ID로 중복 처리를 막고 최초 DB 승인 종료 시각을 보존한다. 응답 유실 후 재전송으로 종료 시각을 바꾸지 않는다.

각 함수는 실패 시 `StudyError`를 throw한다. `code`는 `NETWORK | UNAUTHORIZED | VALIDATION | POLICY_PENDING | NOT_CONFIGURED | UNKNOWN`, `message`는 사용자에게 표시 가능한 한국어다. 실패를 빈 배열·0초로 숨기지 않는다. 프로필 초기화 RPC 이름과 SQL 매개변수는 01이 확정하고 00의 identity 연결부를 변경해야 할 경우 보고한다. 00은 identity에서 호출하는 초기화 함수를 별도 `src/data/profile.ts`로 선언하고 01이 구현한다.

## 구독과 화면

- 구독 연결 완료 후 snapshot 조회, 변경 알림마다 재조회한다. 조회 중 알림이 오면 마지막 조회 후 다시 확인해 갱신을 유실하지 않는다.
- 복귀·재연결 시 DB를 재조회하고 중복 구독을 정리한다. 메시지 도착 순서로 확정 시간을 계산하지 않는다.
- 별도 초 단위 DB 쓰기, 자체 WebSocket 서버, UI heartbeat를 추가하지 않는다. 현재 연결 상태만 표시한다. 구성원별 온라인 여부는 초기 병렬 구현 범위에서 보류한다.
- 화면은 named export로 `TodayScreen`, `RoomScreen`, `GoalsScreen`, `HistoryScreen`을 제공한다. 라우트 파일은 해당 화면을 default export하는 얇은 연결부다.
- 00이 `_layout.tsx`에 현재 존재하는 라우트만 연결한다. 06이 완성된 화면들을 내비게이션으로 묶는다.

## 정책 미정

출석은 pending, 목표 미설정은 null이다. 01은 목표 조회와 기록 조회를 구현할 수 있지만 정책 확정 전 목표 저장은 POLICY_PENDING으로 거부한다. 출석·연차 자동 지급/사용 API는 05 전까지 만들지 않는다. 현재 실행 계획에서 목표 저장과 출석·연차까지 모두 완료되었다고 할 수 없다.
