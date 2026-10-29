# 집중 화면 현수막 운영

현수막은 집중 화면 전용이다. 홈 화면의 표시 슬롯·이미지 입력·서버 필드는 없다. 완성 PNG 한 장과 게시 기간을 방마다 관리하며 새 게시는 기존 예약을 교체한다. 앱은 이미지 위에 문구·천·집게를 덧그리지 않는다.

## 이미지와 표시 순서

집중용 PNG는 1000 × 300, 2MiB 이하이며 투명 배경을 권장한다. 글씨·천·끈·꽃 등 장식을 모두 이미지에 포함한다. 바깥 투명 여백은 최소화한다. 더 큰 원본이나 다른 비율의 시안은 이 업로드 규격에 맞는 별도 완성본이 필요하다.

표시 순서는 배경 → 현수막 → 캐릭터 → 메시지/포스트잇이다. 장식 슬롯은 캐릭터 이전에 렌더링하며 메시지 오버레이는 앞에 유지한다.

## 저장과 권한

- 공개 Storage 버킷 `room-banners`: PNG만 허용, 파일별 2MiB 제한.
- 오브젝트 경로: `rooms/<방>/<새 UUID>/focus.png`.
- `room_banners`: `room_id`(PK/FK), `focus_image_path`, `alt_text`, `enabled`, `starts_at`, `ends_at`, `updated_at`.
- `alt_text`는 스크린리더 설명(한 줄 1~160자)이며 이미지 위에 표시하지 않는다.
- 시작은 필수, 종료는 선택이며 종료가 시작보다 뒤여야 한다. 시각은 유한한 timestamptz만 허용한다. updated_at은 트리거로 갱신한다.

일반 앱 계정은 자기 방의 켜진 예약만 읽고 등록·수정·삭제·관리자 RPC 호출은 못 한다. Storage에는 버킷에 대한 일반 계정 작업을 막는 restrictive policy를 적용한다. 다른 버킷용 permissive policy가 있어도 업로드·수정·삭제·목록 조회는 허용되지 않는다. 관리자 RPC는 SECURITY INVOKER이며 service_role만 실행한다. 서비스 키는 앱에 넣지 않는다.

공개 이미지 파일은 URL을 알면 다운로드할 수 있다. 내리기는 앱의 표시를 종료하며 과거 이미지 URL 접근을 회수하지 않는다. 공지용 그림만 저장한다.

## 관리 도구

신뢰할 수 있는 환경에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 설정한다. 로컬 키 연결이 없다면 실제 업로드 전 연결 설정이 필요하다. 관리자 SQL 도구만으로 로컬 이미지 바이너리를 업로드할 수는 없다.

```sh
node supabase/scripts/manage-banners.mjs show --room 1
node supabase/scripts/manage-banners.mjs publish --room 1 < /private/tmp/banner.json
node supabase/scripts/manage-banners.mjs hide --room 1
```

게시 입력 예시(한국 시간):

```json
{
  "focusFile": "/absolute/path/focus.png",
  "description": "금작가의 데뷔를 축하합니다",
  "startsAt": "2026-11-01T06:00:00+09:00",
  "endsAt": "2026-11-08T06:00:00+09:00"
}
```

집중 파일 경로는 필수다. 홈 파일 인수는 거절한다. 시작 생략은 즉시, 종료 생략/null은 무기한이다. 시간대 없는 시각은 거절한다. 방 0은 테스트, 방 1은 운영이며 대상 방은 명시한다.

관리 도구는 PNG 크기·헤더/청크·규격과 게시 기간을 확인한 후 새 UUID 경로에 업로드한다. 업로드 성공 후 `admin_publish_room_banner(p_room_id,p_focus_image_path,p_alt_text,p_starts_at,p_ends_at)`를 호출한다. RPC도 버킷에 해당 파일이 있는지와 방별 경로를 검사한다. 저장 후 다시 조회해 결과를 검증한다.

실패·시간초과 시 기존 현수막은 덮어쓰지 않으며 자동 재게시하지 않는다. 업로드만 끝난 미사용 파일이 남을 수 있으므로 현재 예약과 오브젝트를 먼저 확인한다. 자동 삭제는 하지 않는다. `admin_hide_room_banner(p_room_id)`는 현수막을 내리고 파일과 예약은 보존한다. 사용자 요청 없이 예시 문구나 생성 이미지를 실제 게시하지 않는다.

## 앱 계약

기존 `get_today()`의 `data.roomBanner`에 집중용 정보를 추가한다. 켜진 예약이 없으면 null이다. 기존 프로필·공부 기록·입장 검사·보상 정산은 보존한다.

```json
{
  "roomId": 1,
  "focusImagePath": "rooms/1/00000000-0000-4000-8000-000000000010/focus.png",
  "altText": "금작가의 데뷔를 축하합니다",
  "enabled": true,
  "startsAt": "2026-10-31T21:00:00+00:00",
  "endsAt": "2026-11-07T21:00:00+00:00",
  "updatedAt": "2026-10-29T09:00:00+00:00"
}
```

집중 화면만 이 정보를 소비한다. 미래/만료 예약도 켜져 있으면 전달되므로 앱은 시작 이상·종료 미만인 동안에만 표시한다. 만료 시 DB enabled가 자동으로 꺼지지는 않는다. 기존 서버 기준 시계를 사용한다.

추가 메타데이터 폴링·실시간 구독·크론은 없다. 기존 StudyProvider의 60초 조회에 포함한다. 이미지 다운로드는 별도로 발생하고 새로운 경로마다 캐시된다. 오프라인에서는 새 게시나 조기 내리기를 즉시 알 수 없다. 이미지 로딩 실패는 배경·공부 조작에 영향을 주지 않도록 현수막만 숨겨야 한다. 앱 decoder와 실제 표시 연결은 후속 작업이다.

## 검증

```sh
node --test tests/room-banner-admin.test.mjs
node supabase/scripts/check-banners-db.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
node supabase/scripts/check-banners-db.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js --before-rewards
npm run lint
npm run typecheck
```

격리 PostgreSQL에서 전체 앱 마이그레이션을 재생한다(외부 cron/Vault 제외). Storage 시스템 테이블은 최소 스키마로 모사한다. 집중 이미지 게시·존재/방 검증·버킷 권한·예약·내리기·기존 스냅샷 호환성을 검증한다. 모의 HTTP로 업로드 실패 시 미게시와 저장 후 재조회를 확인한다. 실제 Storage 업로드·다운로드는 운영 적용과 인증 준비 후 별도로 검증한다.
