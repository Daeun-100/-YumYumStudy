# 방 현수막 이미지 세트 운영

홈·집중은 배치가 달라 완성 이미지 두 장을 따로 제작한다. 두 이미지를 한 세트로 게시하고 기간·내리기는 함께 관리한다. 방마다 예약 하나를 유지하며 새 게시가 기존 예약을 교체한다. 앱은 이미지 위에 문구·천·집게를 추가로 그리지 않는다. 이 서버 PR에는 앱 표시 및 decoder 연결이 포함되지 않는다.

## 이미지 제작 규격

| 화면 | PNG 크기 | 내용 |
|---|---|---|
| 홈 | 1200 × 300 | 햇살 배경에 맞춘 현수막 전체 |
| 집중 | 1000 × 300 | 저녁 배경에 맞춘 현수막 전체 |

각 파일은 2MiB 이하 PNG이며 투명 배경을 권장한다. 글씨·천·끈·집게·그림자를 모두 이미지에 포함한다. 이미지 내부 글씨는 앱에서 수정하지 않는다. 화면에서 250~330px 정도로 축소되므로 글씨를 크게 배치한다. 이미지 바깥 투명 여백은 최소화한다. 제작 규격 변경 시 관리 도구와 앱의 배치 비율을 함께 갱신한다.

## 저장 및 권한

- Storage 버킷 `room-banners`: 공개 이미지 다운로드, 2MiB 제한, PNG만 허용.
- 오브젝트: `rooms/<방>/<새 UUID>/home.png`, `rooms/<방>/<같은 UUID>/focus.png`.
- 테이블 `room_banners`: `room_id`(PK/FK), `home_image_path`, `focus_image_path`, `alt_text`, `enabled`, `starts_at`, `ends_at`, `updated_at`.
- `alt_text`는 스크린리더가 읽을 이미지 내용 설명(한 줄 1~160자)이다. 화면에 별도 글씨로 표시하지 않는다.
- `starts_at`은 필수, `ends_at`은 선택이며 종료는 시작보다 뒤여야 한다. 유한한 timestamptz만 허용한다. `updated_at`은 트리거가 갱신한다.

일반 앱 계정은 자기 방의 켜진 예약만 조회한다. 테이블 쓰기와 관리자 RPC 실행은 차단한다. Storage에는 해당 버킷에 대한 일반 계정 작업을 막는 restrictive policy를 적용하여 다른 버킷용 permissive policy가 있어도 업로드·수정·삭제·목록 조회가 허용되지 않도록 한다. 관리자 RPC는 SECURITY INVOKER이고 service_role만 실행한다. 서비스 키는 앱에 넣지 않는다.

공개 버킷의 파일은 URL을 아는 사람이 다운로드할 수 있다. 예약을 내리는 것은 앱에서의 표시 종료이며, 기존 이미지 URL의 다운로드 권한을 회수하는 동작은 아니다. 공지용 그림만 저장한다.

## 게시 흐름

1. 대상 방과 현재 예약을 조회한다. 방 0은 테스트, 방 1은 운영이다.
2. 홈·집중 이미지 두 장과 설명·시작/종료 시각을 확인한다.
3. 관리 도구가 파일 크기·PNG 헤더/청크·화면별 크기와 기간을 검사한다. 두 파일의 검사가 끝나기 전에는 업로드하지 않는다.
4. 새 UUID 경로로 두 파일을 순서대로 업로드한다. 기존 파일은 덮어쓰지 않는다.
5. 두 업로드가 성공하면 `admin_publish_room_banner`를 한 번 호출해 경로·예약을 함께 교체한다. RPC도 두 오브젝트가 버킷에 존재하는지와 방별 경로를 검사한다.
6. 다시 조회해 저장 결과를 검증한다.

두 번째 업로드나 게시가 실패해도 기존 게시 세트는 바뀌지 않는다. 업로드만 끝난 미사용 파일은 남을 수 있다. 실패·시간초과 시 자동 재게시나 자동 삭제하지 말고 현재 예약과 오브젝트부터 확인한다. 기존 이미지는 장기 캐시를 사용할 수 있으므로 매번 새로운 경로를 쓴다.

## 관리 도구

신뢰할 수 있는 환경에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 설정한다. 로컬 키 연결이 없으면 실제 이미지 업로드 전에 연결 설정이 필요하다. Supabase SQL 도구만으로 로컬 이미지 바이너리를 Storage에 업로드할 수는 없다.

```sh
node supabase/scripts/manage-banners.mjs show --room 1
node supabase/scripts/manage-banners.mjs publish --room 1 < /private/tmp/banner.json
node supabase/scripts/manage-banners.mjs hide --room 1
```

게시 입력 예시(한국 시간):

```json
{
  "homeFile": "/absolute/path/home.png",
  "focusFile": "/absolute/path/focus.png",
  "description": "11월도 같이 달려요!",
  "startsAt": "2026-11-01T06:00:00+09:00",
  "endsAt": "2026-11-08T06:00:00+09:00"
}
```

두 경로 모두 필수이며 다른 파일이어야 한다. 시작 생략은 즉시, 종료 생략/null은 무기한이다. 시간대 없는 시각은 거절한다. publish/hide는 재조회하여 결과를 검증한다. 임시 입력 파일은 완료 후 삭제한다. `admin_hide_room_banner(p_room_id)`는 두 화면을 함께 내리며 이미지와 예약을 보존한다.

이미 업로드된 파일을 연결된 관리자 SQL로 게시하는 경우 RPC 인수는 `p_room_id`, `p_home_image_path`, `p_focus_image_path`, `p_alt_text`, `p_starts_at`, `p_ends_at`이다. 업로드와 게시 모두 사용자의 구체적인 이미지·대상·기간 요청에 따라 실행한다.

## 앱 계약

기존 `get_today()`의 `data.roomBanner`에 아래 객체를 추가한다. 켜진 예약이 없으면 null이다. 프로필·공부 기록·보상 정산·입장 검사는 유지한다.

```json
{
  "roomId": 1,
  "homeImagePath": "rooms/1/00000000-0000-4000-8000-000000000010/home.png",
  "focusImagePath": "rooms/1/00000000-0000-4000-8000-000000000010/focus.png",
  "altText": "11월도 같이 달려요!",
  "enabled": true,
  "startsAt": "2026-10-31T21:00:00+00:00",
  "endsAt": "2026-11-07T21:00:00+00:00",
  "updatedAt": "2026-10-29T09:00:00+00:00"
}
```

미래/만료 예약도 켜져 있다면 전달한다. 앱은 `startsAt <= 서버 기준 현재 시각`이고 `endsAt == null || 서버 기준 현재 시각 < endsAt`일 때만 표시한다. 기간 만료 시 DB enabled를 자동 변경하지 않는다. 앱은 화면별 경로를 Supabase public Storage URL로 변환하고 비율을 유지해 그린다. 이미지 로딩 실패 시 배경과 공부 조작을 가리지 않고 현수막만 숨기는 처리가 필요하다.

배너 메타데이터는 기존 StudyProvider의 60초 조회에 포함하며 별도 폴링/실시간 구독/크론은 추가하지 않는다. 이미지 파일 다운로드는 별도로 발생하고 새 경로마다 캐시된다. 예약 시각 판단은 기존 서버 기준 시계를 사용한다. 오프라인에서는 조기 내리기·새 게시를 즉시 알 수 없다. 현재 앱 decoder는 신규 필드를 보존하지 않으므로 후속 앱 구현 시 연결해야 한다.

## 검증

```sh
node --test tests/room-banner-admin.test.mjs
node supabase/scripts/check-banners-db.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
node supabase/scripts/check-banners-db.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js --before-rewards
npm run lint
npm run typecheck
```

격리된 PostgreSQL에 앱 마이그레이션을 재생한다(외부 cron/Vault 제외). Storage 시스템 테이블은 테스트용 최소 스키마로 모사한다. 버킷 설정·RLS·두 이미지 누락·다른 방 경로·원자적 게시·예약·내리기·기존 스냅샷 호환성을 검증한다. HTTP 업로드는 모의 테스트로 순서·중간 실패·미게시·재조회 동작을 확인한다. 실제 Storage 업로드·다운로드 검증은 운영 적용과 인증 준비 후 별도로 수행한다.
