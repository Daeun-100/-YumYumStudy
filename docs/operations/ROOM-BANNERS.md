# 방 현수막 서버 운영

홈·집중이 같은 문구와 기간을 사용하는 방별 현수막이다. 방마다 한 행과 예약 하나만 유지하며 새 게시는 기존 예약을 교체한다. 화면별 현수막 이미지·위치는 앱에서 관리한다. 이 변경에는 앱 표시 기능이 포함되지 않는다.

## 저장 및 앱 조회

`public.room_banners`: `room_id`(PK/FK), `message`(앞뒤 공백 없는 한 줄 1~40자), `enabled`, `starts_at`(필수), `ends_at`(선택), `updated_at`(트리거 자동 갱신). 시각은 유한한 `timestamptz`이며 종료는 시작보다 뒤여야 한다. 종료 없음은 무기한이다.

기존 `get_today()`의 `data.roomBanner`에 아래 객체가 추가된다. 기존 프로필·공부 기록·보상 정산·입장 검사는 유지한다. 해당 방에 켜진 현수막이 없으면 `null`이다. 미래/만료 예약도 켜져 있다면 전달되므로 앱은 `startsAt <= 서버 기준 현재 시각` 및 `endsAt == null || 서버 기준 현재 시각 < endsAt`일 때만 그려야 한다. `enabled`는 운영자의 게시 허용 상태이며 기간 만료 시 DB에서 자동으로 꺼지지는 않는다.

```json
{
  "roomId": 1,
  "message": "11월도 같이 달려요!",
  "enabled": true,
  "startsAt": "2026-10-31T21:00:00+00:00",
  "endsAt": "2026-11-07T21:00:00+00:00",
  "updatedAt": "2026-10-29T09:00:00+00:00"
}
```

추가 요청/타이머/실시간 구독/크론은 없다. 앱 구현 시 기존 StudyProvider의 60초 갱신과 서버 기준 공통 시계를 사용한다. 조기 내리기·문구 변경은 다음 정상 조회 때 반영되며 오프라인 중에는 즉시 반영을 보장하지 않는다. 아직 기존 앱 decoder는 새 필드를 보존하지 않으므로 UI 작업 시 계약·decoder 연결도 필요하다.

## 권한

RLS와 명시적 GRANT를 함께 적용한다. 입장이 확인된 사용자는 자기 방의 켜진 예약만 읽는다. `anon`은 읽지 못하며 일반 앱 사용자는 INSERT/UPDATE/DELETE 및 관리자 RPC 실행 권한이 없다. 관리자 RPC는 SECURITY INVOKER이며 `service_role`에만 실행 권한을 준다. 비밀 키는 Expo 환경변수나 앱에 넣지 않는다.

채팅 운영 시 연결된 Supabase 관리자 SQL 도구로 아래 RPC를 실행할 수 있다. 방 0은 테스트, 방 1은 운영이며 쓰기 전에 대상 방과 현재 행을 확인한다. 사용자 문구는 SQL 문자열 보간 대신 바인딩하거나 SQL 리터럴을 안전하게 이스케이프한다. 문구와 기간을 임의로 만들어 운영 게시하지 않는다.

- 게시: `admin_publish_room_banner(p_room_id, p_message, p_starts_at, p_ends_at)`
- 내리기: `admin_hide_room_banner(p_room_id)` — 문구/예약 보존, 행이 없으면 null
- 조회: `room_banners`에서 대상 `room_id`로 조회

게시의 기본 시작은 즉시, 기본 종료는 없음이다. 두 화면에 동시에 적용된다. 작업 후 같은 방을 다시 조회하여 저장 결과를 확인한다. 실패나 시간초과 시 자동 재실행하지 말고 현재 상태부터 조회한다.

## 로컬 관리 스크립트

신뢰할 수 있는 운영 환경에서 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 제공하면 다음 도구를 사용할 수 있다. 연결된 관리자 SQL 도구는 이 로컬 키 설정 없이 운영할 수 있다.

```sh
node supabase/scripts/manage-banners.mjs show --room 1
node supabase/scripts/manage-banners.mjs publish --room 1 < /private/tmp/banner.json
node supabase/scripts/manage-banners.mjs hide --room 1
```

게시 입력 예시(한국 시간, 다른 시간대도 명시하면 허용):

```json
{"message":"11월도 같이 달려요!","startsAt":"2026-11-01T06:00:00+09:00","endsAt":"2026-11-08T06:00:00+09:00"}
```

`startsAt`을 생략하면 즉시, `endsAt`을 생략하거나 null이면 무기한이다. 날짜만 쓰거나 시간대 없는 시각은 거절한다. publish/hide 뒤 자동으로 서버를 재조회하여 결과를 검증한다. 임시 입력 파일은 작업 후 삭제한다.

## 검증

```sh
node --test tests/room-banner-admin.test.mjs
node supabase/scripts/check-banners-db.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
npm run lint
npm run typecheck
```

DB 검증은 격리된 PostgreSQL에서 전체 앱 마이그레이션을 재생한다(외부 cron/Vault 제외). 게시/교체/내리기, 미래·만료·무기한 예약, 잘못된 문구/기간, 일반 계정·익명 권한, 입장 전 접근, 방 격리, 기존 스냅샷 및 타임스탬프를 확인한다. PGlite는 임시 개발 도구로 사용하며 앱 의존성에 추가하지 않는다.
