# 이벤트 기록과 예약 운영

> 배경·스킨의 서버 이미지 전달과 기존 효과 설정을 구현하고 서버 반영·실제 업로드 검증을 완료했다. 최초 지원 앱의 배포·적용은 아직 수행하지 않았다. [서버 이미지 운영](ARTWORK-OPERATIONS.md)에서 업로드·검증·게시 방법과 반영 현황을 확인한다. 아래 예약 CLI와 기존 예약 서버는 유지한다.

이벤트 기획·이미지·결과는 [이벤트 폴더](../events/README.md)에 남긴다. 서버는 스킨 지급 예약, 방별 홈·집중 배경 기간, 실제 실행·지급 이력을 관리한다. 채팅용 스킬은 [yumyum-manage-events](../../.agents/skills/yumyum-manage-events/SKILL.md)다.

## 지원 범위

- `grant_skins`: 예약 당시 입장 완료한 방 구성원에게 지정 스킨 묶음을 영구 지급한다. 착용·캐릭터를 바꾸지 않는다. 신규 입장자는 추가하지 않고 실행 시 자격 상실자는 제외한다.
- `set_backgrounds`: 지정 방의 홈·집중 또는 한 화면의 공통 배경을 시작 이상·종료 미만 기간에 적용한다. 기간 중 신규 입장자도 본다. 종료 시 기본 배경으로 돌아간다. 개인 보유 아이템 지급과는 별개다.
- 배너·화면 효과·소품·수집·교환은 문서에 기록할 수 있으나 자동 실행은 지원하지 않는다.

최대 500명·40종 스킨을 한 작업으로 처리한다. 더 큰 규모는 별도 배치 구현 후 운영한다. 배경은 `halloween` 세트를 등록하되 기본 지급·예약 가능 상태는 비활성이다. 앱에 이미지가 전달된 뒤 관리자 요청으로 활성화한다.

## 채팅으로 운영

- 기록: “올해 핼러윈 이벤트 문서 만들어줘. 배경을 바꾸고 붕어빵 스킨을 선물할 거야.”
- 지급 예약: “2026년 10월 31일 오전 9시에 1번방 전원에게 문서에 정한 스킨 4종 지급 예약해줘.”
- 배경 예약: “2026년 10월 31일 오전 9시부터 11월 1일 오전 6시까지 1번방 홈·집중 배경을 핼러윈으로 바꿔줘.”
- 조회: “예약된 이벤트 보여줘.” / “이 이벤트 지급 결과 기록해줘.”
- 변경: “이 지급을 하루 앞당겨줘.” / “이 배경 종료를 11월 2일 오전 6시로 바꿔줘.”
- 취소·중단: “이 지급 예약 취소해줘.” / “진행 중인 핼러윈 배경 내려줘.”
- 복구: “실패한 사람만 다시 지급해줘.” / “놓친 이 예약 지금 실행해줘.”

연도·시각·방·선물 또는 배경과 종료 시각을 확정한 뒤 실행한다. 한국 시간으로 해석하며 문서나 대화에 이미 있는 값은 재질문하지 않는다. 서버에서 지원·활성 상태와 대상·기간을 확인하고 실제 예약을 재조회한 뒤 완료를 알린다.

조회 요청만으로 재지급·누락 실행 복구를 하지 않는다. 문서에는 작업 ID·확인 시각·집계를 남기고 개인 UUID나 명단은 넣지 않는다. 문서와 서버 처리는 서로 다른 저장 작업이라, 한쪽 실패를 양쪽 실패로 보고하지 않는다.

## 최초 서버·앱 준비

1. [서버 운영](SERVER-OPERATIONS.md)에 따라 프로젝트·스키마·마이그레이션 이력을 대조하고 `event_operations` 마이그레이션만 적용한다. 기존 DB에 전체 초기화나 전체 재생을 실행하지 않는다.
2. 실제 Cron 시간대를 확인한다. 이번 구현은 GMT/UTC/Etc/UTC만 지원하며 다른 설정에서는 예약을 거부한다.
3. 일반 앱 권한은 자기 방의 배경 읽기와 최소 갱신 신호만 허용한다. 관리자 함수는 서비스 역할 전용이다. 앱에서 운영 기록은 읽지 못한다.
4. 테스트방에서 실제 Cron 실행·해제, 앱 조회, 변경·취소를 검증한다. 격리 DB의 Cron 대체 검증과 실제 실행 검증을 구분한다.
5. 홈·집중 배경 선택 코드와 이미지를 기존 배포 절차로 전달하고 확인한 뒤 배경 예약을 활성화한다. 미지원 앱은 기존 배경을 계속 표시한다. 앱 배포는 [릴리스 절차](RELEASES.md)를 따른다.

## 운영 CLI

신뢰된 운영 환경에 `SUPABASE_URL`(또는 `EXPO_PUBLIC_SUPABASE_URL`)과 `SUPABASE_SERVICE_ROLE_KEY`가 필요하다. 서비스 키는 비공개 환경에만 두고 명령 인자·문서·앱에 넣지 않는다.

```sh
node supabase/scripts/manage-events.mjs list
node supabase/scripts/manage-events.mjs status --job JOB_UUID
node supabase/scripts/manage-events.mjs schedule --request /private/tmp/event-request.json
node supabase/scripts/manage-events.mjs cancel --job JOB_UUID
node supabase/scripts/manage-events.mjs recover --job JOB_UUID --phase grant
node supabase/scripts/manage-events.mjs background --id halloween --enabled
```

기본 출력은 개인 UUID·지급 명단을 제외한다. 사용자별 실패를 확인해야 할 때만 비공개 환경에서 `--details`를 사용한다. `--disabled`는 새 배경 예약만 막고 기존 예약 기간은 바꾸지 않는다.

예약 입력 예시(실제 예약이 아님):

```json
{
  "request_id": "새로 생성한 UUID",
  "event_id": "2026-halloween",
  "name": "2026 핼러윈",
  "document_path": "docs/events/2026-10-31-halloween.md",
  "kind": "set_backgrounds",
  "room_id": 1,
  "run_at": "2026-10-31T09:00:00+09:00",
  "ends_at": "2026-11-01T06:00:00+09:00",
  "background_id": "halloween",
  "screens": ["home", "focus"]
}
```

스킨 작업은 `kind`를 `grant_skins`로 하고 배경 필드·`ends_at` 대신 `skin_ids` 배열을 넣는다. 요청 ID가 작업 ID다. 연결 실패로 결과가 불명확하면 먼저 이 ID를 조회하고 동일 입력·ID로 재시도한다. 새 ID를 발급해 중복 예약하지 않는다.

변경은 입력에 `replaces: "기존 작업 UUID"`를 넣고 새 요청 ID로 예약한다. 기존 예약은 대체 상태로 보존되며 취소와 신규 등록이 함께 확정된다. 스킨 대상은 기존 명단을 유지한다. 진행 중 배경은 원래 `run_at`을 유지하고 종료·배경 세트를 변경한다. 이미 끝난 기간이나 이미 실행한 지급은 변경·취소하지 못한다.

CLI 자격이 없고 연결된 Supabase 도구가 있으면 다음 관리자 RPC를 같은 의미로 호출할 수 있다. 임의 사용자 SQL을 실행하지 않고 JSON은 SQL 리터럴로 안전하게 인코딩한다.

| RPC | 인자 |
| --- | --- |
| `admin_schedule_event` | `p_request: jsonb` |
| `admin_event_report` | `p_job: uuid` 또는 NULL(전체) |
| `admin_cancel_event` | `p_job: uuid` |
| `admin_recover_event` | `p_job: uuid`, `p_phase: grant/start/end` |
| `admin_enable_event_background` | `p_id: text`, `p_enabled: boolean` |

## 스킨 지급 푸시 알림

새로 지급된 스킨이 있는 사용자에게 작업당 한 번 기본 알림을 보낸다. `already_owned`, 실패·제외 대상, 배경 시작·종료에는 보내지 않는다. 여러 스킨을 함께 받아도 한 알림으로 묶는다. 예약 당시 이미 등록된 앱·웹 알림 기기를 재사용하며 알림 허용과 기기 등록이 필요하다.

문구는 필수가 아니다. 기본 제목은 “이벤트 스킨 선물이 도착했어요!”, 본문은 이벤트 이름·새로 받은 스킨 수·프로필 확인 안내다. 스킨 지급 예약 JSON에 선택 항목을 추가할 수 있다.

```json
"notification": {
  "title": "핼러윈 선물이 도착했어요!",
  "body": "프로필에서 새 스킨을 확인해 주세요."
}
```

- 생략하거나 빈 객체이면 기본 문구를 사용한다. 제목·본문은 각각 독립적으로 생략할 수 있다.
- `"notification": { "enabled": false }`이면 해당 지급의 푸시를 끈다.
- 제목 최대 80자, 본문 최대 160자이며 공백만 있는 문구·제어문자·지원하지 않는 필드는 거부한다. 문구는 예약 시 고정하며 변경은 기존 예약 대체 절차를 따른다.
- 지급 확정 트랜잭션에서 `private.event_notifications`에 작업·사용자별 고유 알림 ID와 문구를 기록한다. `pg_net` 호출은 지급 트랜잭션이 커밋된 뒤 시작하므로 롤백된 지급의 푸시는 발송하지 않는다. 정기 조회 Cron이나 앱 타이머는 추가하지 않는다.
- `event-notifications` Edge Function은 DB가 기록한 ID만 받아 기존 `admin-notifications`로 전달한다. 수신자·문구를 외부 요청으로 바꿀 수 없다. DB↔Edge 호출은 이미 준비된 Vault의 `log_monitor_cron_secret`과 Edge `MONITOR_CRON_SECRET`을 사용한다. 기존 키를 조회·출력하거나 회전하지 않는다.
- `event-notifications`와 `20261029154729_event_skin_notifications`는 2026-10-30 공유 서버에 반영했다. 기존 `admin-notifications`와 `ADMIN_NOTIFICATION_TOKEN` 설정을 사용하며 인증된 dry-run에서 준비 상태를 확인했다. 앱·APK 업데이트는 필요 없다. 기존 앱의 알림 허용/등록과 알림 채널을 사용한다. 알림을 눌러 스킨 상세로 이동하는 새 동작은 포함하지 않는다.
- 알림 전송 오류는 지급을 되돌리지 않는다. 큐 상태 `completed`는 기존 발송 함수의 처리가 완료됐다는 뜻이며 기기 표시 성공을 뜻하지 않는다. 실제 기기별 결과·Expo 접수 티켓은 같은 ID의 `public.admin_notification_dispatches`에서 확인한다. 등록 기기가 없으면 푸시가 가지 않으며 미등록 집계로 남는다.
- 네트워크 결과가 불명확하면 새 알림 ID를 만들지 않는다. 원래 ID로 상태를 확인한 뒤 관리자 요청에 따라 `admin_retry_event_notification(p_id)`를 호출한다. 같은 ID를 기존 발송 함수가 중복 처리하지 않는다. 자동 재시도·실패자 재지급은 하지 않는다.
- 큐에는 RLS와 직접 접근 차단을 적용한다. 조회·완료 기록·재요청 RPC는 서비스 역할 전용이다. 기존 지급·이벤트 이력을 자동으로 소급 발송하지 않는다.

검증: `node supabase/scripts/check-event-notifications-db.mjs ABSOLUTE_PATH_TO_PGLITE/dist/index.js`. 이는 Vault·HTTP 큐를 대체한 격리 DB 검증이며 실제 기기 수신과 구분한다.

## 실행·누락·복구

예약마다 특정 월·일·시·분의 Cron을 만들고 실행 후 해제한다. 예약 전체를 1분마다 조회하는 작업은 없다. 배경은 시작·종료 두 작업을 만들며 취소·변경 시 함께 처리한다. 연도를 포함한 서버 시각 검증과 다음 Cron 발생 시각 검증으로 다음 해 재지급을 막는다. 예약은 향후 1년 이내·분 단위만 받는다.

서버 중단이나 시간 초과 시 정시 실행을 보장하지 않는다. `overdue`와 실행·Cron 이력을 확인한다. 자동 실행은 예정 시각부터 24시간 미만만 허용하고, 이후 복구는 명시적 관리자 요청으로 수행한다. 정기 재시도·알림은 없다.

- 스킨은 사용자별 묶음 지급과 결과를 함께 확정한다. 한 사람의 묶음 실패는 되돌리고 다른 사람은 처리한다. 재실행은 기존 성공자를 건너뛴다. 기보유 스킨은 최초 지급 정보를 유지한다.
- 배경은 서버의 기간·취소 설정이 기준이다. 종료 Cron이 누락되어도 종료 시각 이후 기본 배경을 반환한다. 끝난 배경을 다시 켜기 위해 시작 작업을 복구하지 않는다.
- 배경 중단은 서버 설정을 취소하고 시작·종료 Cron을 해제한다. 연결 중인 앱은 변경 신호 후 재조회하고, 앱에는 배경 시작·종료용 타이머를 두지 않는다. 오프라인이거나 신호를 놓친 화면은 마지막 조회 결과를 유지하며, Realtime 재연결·화면 재진입·앱 복귀 시 재조회가 성공하면 반영한다.
- DB 전체 트랜잭션 실패는 작업 결과 기록까지 되돌릴 수 있다. Cron 이력과 원본 보유 상태를 대조하고 해당 작업을 복구한다. Cron 정리만 실패한 경우 원래 작업을 새 ID로 재등록하지 않는다. 같은 작업의 복구·취소를 통해 정리한다.

## 검증 명령

```sh
npm run lint
npm run typecheck
npm test
node supabase/scripts/check-events-db.mjs ABSOLUTE_PATH_TO_PGLITE/dist/index.js
node supabase/scripts/check-skins-db.mjs ABSOLUTE_PATH_TO_PGLITE/dist/index.js
npm run build-storybook
```

실제 서버 반영·Cron 검증·앱 시각 검증 결과는 아래에 확인한 범위만 기록한다.

## 2026-10-29 구현 검증 현황

- 기능 브랜치에서 서버 마이그레이션, 앱 배경 연결, CLI와 프로젝트 스킬을 구현했다.
- 격리 PostgreSQL에서 전체 앱 마이그레이션 재생 후 예약 중복 방지·변경·취소·묶음 원자성·일부 실패 복구·기보유 정보 보존·배경 충돌·기간·권한을 검증했다. Cron은 이 검증에서 대체 구현이다.
- Storybook 웹에서 핼러윈 홈·집중 배경과 미지원 배경의 기본 이미지 대체를 시각 확인했다. Android 실기기와 iPhone 웹앱의 실제 표시·서버 연동은 아직 확인하지 않았다.
- 사용자 승인 후 공유 Supabase에 `20261029120541_event_operations`를 반영했다. 로컬 마이그레이션 파일명도 실제 서버 이력과 일치시켰다.
- 0번 테스트방의 실제 Cron에서 21:08 스킨 지급·배경 시작과 21:09 배경 종료(한국 시간)가 성공했고 세 Cron 모두 자동 해제됐다. 테스트 전용 스킨은 11명에게 지급된 후 해당 실행에서 추가한 보유 내역만 정리했다.
- 실제 서버에서 동일 요청 중복 방지·예약 대체·취소, 완료 지급 재호출의 중복 방지와 자기 방 배경 조회·다른 방 및 관리자 접근 거부를 확인했다. 배경 종료 후 사용자용 조회에 유효 배경이 없음을 확인했다.
- 검증용 배경 정의는 이력 참조를 위해 비활성으로 보존하고 테스트 스킨 정의는 정리했다. `halloween` 세트는 앱 배포·수신 확인 전까지 비활성이다. [검증 이벤트 기록](../events/2026-10-29-server-verification.md)에 작업 ID와 결과를 남겼다.
- 보안 점검의 신규 private 테이블 5개에 대한 RLS 정책 없음 정보는 직접 테이블 접근을 차단하고 제한된 함수만 사용하는 의도된 구성이다. 공개 관리자 RPC는 SECURITY INVOKER이며 앱 역할의 실행 권한이 없다. [RLS 점검 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)을 참고한다.
- 앱 배포와 운영방 실제 행사 예약은 수행하지 않았다.

## 2026-10-30 지급 푸시 검증

- 스킨 지급 후 알림 큐와 `event-notifications` Edge Function v2를 공유 서버에 반영했다. [검증 기록](../events/2026-10-30-event-push-verification.md).
- 테스트 377개, 린트·타입 검사, 이벤트·원격 이미지·스킨·알림 격리 DB 검증 통과.
- 실제 서버 트랜잭션에서 신규 지급 11건·알림 큐 11건·HTTP 대기 11건과 지정 문구를 확인 후 롤백했다. 테스트 스킨·보유·작업·알림 큐는 남지 않았으며 푸시는 전송하지 않았다.
- 실제 DB→Edge 인증 호출은 200, 잘못된 자격 호출은 401이었다. dry-run에서 기존 발송 자격 구성 완료를 확인했다.
- 추가 보안 점검 정보는 private 알림 큐의 정책 없음 1건이다. RLS·직접 접근 차단·서비스 전용 함수 구성이며 일반 앱 역할의 접근 차단을 확인했다. [점검 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- 실제 푸시 서비스 접수와 Android/iPhone의 기기 표시는 별도 테스트가 필요하다. 이전 지급을 소급 발송하지 않는다.
