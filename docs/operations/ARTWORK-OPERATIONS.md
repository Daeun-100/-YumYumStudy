# 주제별 꾸미기 이미지 운영

배경·스킨·포스트잇 PNG는 Supabase Storage의 `event-artwork` 버킷에 주제별로 보관한다. 에셋은 이벤트와 독립된 `private.artwork_library`에 등록하고 여러 이벤트가 같은 배경·스킨을 참조한다. 새 등록에는 이미지 버전 UUID나 초안→리비전 게시 절차를 사용하지 않는다. 기존 스킨 보유 ID와 지난 행사·구버전 앱의 이미지 기록은 보존한다.

공통 도구는 `supabase/scripts/manage-artwork.mjs`다. 배경·스킨은 `--home`·`--focus`, 포스트잇은 `--paper`와 선택 `--preview`를 사용한다. 포스트잇 보상·신규 지급 활성화는 [포스트잇 운영](POSTIT-DESIGNS.md), 개인 스킨 지급·착용은 [스킨 운영](CHARACTER-SKINS-OPERATIONS.md), 행사 예약은 [이벤트 운영](EVENT-OPERATIONS.md)을 따른다.

## 저장 구조

```text
event-artwork/
├─ halloween/
│  └─ backgrounds/
│     ├─ home.png
│     └─ focus.png
└─ winter/
   └─ skins/bungeoppang-bunny/
      ├─ home.png
      └─ focus.png
```

주제·폴더·PNG 파일명은 소문자 영문·숫자·하이픈·밑줄을 쓴다. 같은 주제 안에 여러 배경·스킨 폴더를 둘 수 있고 `home-2.png`처럼 파일명을 직접 정할 수 있다. 외부 URL·경로 이탈·다른 주제/종류의 경로는 거부한다.

- 라이브러리 `theme`: 핼러윈·겨울 등 주제.
- `id`: 스킨 보유·착용 및 이벤트의 참조를 유지하는 내부 식별자. 이미지 버전이 아니다. 스킨 ID·캐릭터는 이미 지급한 후 바꾸지 않는다. 배경 ID는 생략 시 `<theme>-room`으로 생성한다.
- `home` / `focus`: 실제 PNG 경로와 해시·크기·규격. 등록 시 두 파일의 공개 주소를 검증한다.
- 효과 실행 코드는 앱에 두고 기존 warmSteam의 위치·폭·투명도만 설정한다. 새 효과 동작·캐릭터·미지원 스키마는 코드 작업이다.

이벤트 종료는 라이브러리를 삭제하지 않는다. 다음 행사에서 같은 배경·스킨을 다시 선택할 수 있다. 라이브러리의 경로나 표현 정의를 수정하면 이를 사용하는 이벤트·보유자에게도 반영되므로, 행사별 다른 이미지를 유지하려면 별도 에셋/파일명을 사용한다.

## 규격과 보안

배경·스킨 PNG 한 파일 최대 5 MiB, 두 파일 합계 최대 10 MiB. 홈 1536×1024, 스킨 집중 1254×1254, 배경 집중 1024×1536. 8비트 RGB/RGBA·비인터레이스 PNG이며 스킨에는 실제 투명 픽셀이 필요하다. 운영 도구가 서명·CRC·압축 데이터·규격·투명도와 실제 공개 다운로드 SHA-256을 검사한다.

버킷에는 공개 가능한 꾸미기 PNG만 올린다. 앱 역할에는 업로드·수정·삭제를 허용하지 않는다. 서비스 키는 신뢰된 운영 환경에서만 사용하며 인자·정의·문서에 넣지 않는다. 라이브러리는 private·RLS·직접 접근 차단을 적용하고 등록·전체 목록은 관리자 RPC로만 제공한다. 사용자용 조회는 자기 보유 또는 같은 방 친구의 착용 스킨, 자기 방 배경으로 제한한다.

포스트잇은 종이·선택 미리보기 각각 최대 2 MiB의 512–2048 px 정사각 PNG다. 미리보기는 불투명 이미지여야 한다. 이미 붙인 종이를 보존하므로 포스트잇 `--replace`는 거부하며 새 파일 경로를 등록한다.

## 정의와 등록

```json
{
  "schemaVersion": 2,
  "theme": "winter",
  "kind": "skin",
  "id": "bungeoppang-bunny",
  "name": "붕어빵 토끼",
  "character": "bunny",
  "home": "winter/skins/bungeoppang-bunny/home.png",
  "focus": "winter/skins/bungeoppang-bunny/focus.png",
  "homePlacement": { "scale": 0.72, "x": 768, "y": 860 },
  "focusBottom": 1154,
  "effects": []
}
```

경로를 생략하면 배경은 `<theme>/backgrounds/home.png`, 스킨은 `<theme>/skins/<id>/home.png`를 사용한다. 배경에는 캐릭터·스킨 배치·효과를 넣지 않는다. 표시 예시는 실제 이미지에 맞춰 확인한다.

```sh
# 로컬 검사와 경로·해시·규격이 포함된 manifest 생성
node --experimental-strip-types supabase/scripts/manage-artwork.mjs prepare --definition CONFIG.json --home HOME.png --focus FOCUS.png --out MANIFEST.json
# 업로드 → 두 공개 파일 검증 → 라이브러리 등록. --activate는 지급/배경 예약 가능 상태만 활성화한다.
node --experimental-strip-types supabase/scripts/manage-artwork.mjs upload --definition CONFIG.json --home HOME.png --focus FOCUS.png --activate
# 이미 업로드한 파일의 manifest를 검증하고 등록
node --experimental-strip-types supabase/scripts/manage-artwork.mjs register --definition MANIFEST.json --activate
node --experimental-strip-types supabase/scripts/manage-artwork.mjs list --theme winter
# 포스트잇도 같은 등록·검증·목록 명령을 사용한다. 정의에는 kind: postit을 지정한다.
node --experimental-strip-types supabase/scripts/manage-artwork.mjs upload --definition POSTIT.json --paper PAPER.png --preview PREVIEW.png
node --experimental-strip-types supabase/scripts/manage-artwork.mjs verify --definition MANIFEST.json
```

`prepare`는 자격 없이 실행한다. 나머지는 `SUPABASE_URL` 또는 공개 URL 환경 변수와 비공개 `SUPABASE_SERVICE_ROLE_KEY`를 사용한다. 연결된 Supabase 도구를 쓰면 같은 `admin_register_artwork(p_definition,p_activate)`와 `admin_artwork_library(p_theme)`를 호출한다. 등록만으로 스킨 지급이나 이벤트 예약을 하지 않는다.

기본 업로드는 기존 파일을 덮어쓰지 않고 같은 바이트일 때만 재사용한다. 수정은 `home-2.png`처럼 새 파일명을 권장한다. 사용자가 같은 경로 덮어쓰기를 명시한 경우에만 `upload --replace`를 사용하고 두 파일을 다시 검증·등록한다. 앱은 파일 해시를 이미지 URL의 캐시 키에 포함해 이전 파일과 구분한다. Storage 화면에서 파일만 덮어쓰고 정의를 갱신하지 않으면 해시·크기·캐시가 불일치할 수 있다. 구버전 UUID 경로 파일에는 덮어쓰기를 허용하지 않는다.

## 앱 조회와 보존 기록

- 앱과 운영 도구는 schemaVersion 2·주제별 경로만 사용한다. UUID 정의·파일 경로를 읽는 분기와 운영 도구의 publish/--revision 명령은 제거했다.
- 앱 조회는 `get_skin_artwork(p_ids,p_room_id)`, `get_event_backgrounds(p_room_id)`로 통일한다. `p_schema_version` 인자와 중복 RPC를 사용하지 않는다.
- 기존 보유·착용 ID, 과거 이벤트의 이미지 참조 필드·리비전 테이블, 기존 Storage 파일은 기록 보존용으로 남긴다. 현재 등록·조회에서는 사용하지 않는다. 기존 지급 내역을 삭제하거나 재지급하지 않는다.
- UUID 읽기 호환을 유지하지 않으므로 새 테스트 앱 업데이트를 적용해야 한다. 이전 이미지가 캐시에 있어도 UUID 정의는 복원하지 않으며 지원하지 않는 이미지는 기본 모습으로 대체한다.
- 방별 `event_background_versions.revision`은 Realtime 변경 신호 번호이며 이미지 버전과 별개다.
- 다운로드 공유·동시 준비 최대 4개·이미지 실패 대체·사용자/방별 메타데이터 캐시는 유지한다. 배경 전환에는 타이머를 두지 않고 Realtime·재연결·화면 재진입·앱 복귀 시 조회한다.

## 검증

```sh
npm run lint
npm run typecheck
npm test
node supabase/scripts/check-themed-artwork-db.mjs ABSOLUTE_PATH_TO_PGLITE/dist/index.js
```

주제별 경로·등록·재사용·경로 수정·보유/방 권한·단일 형식 조회 API을 격리 DB에서 검사한다. 실제 Storage·서버 반영·앱 업데이트 검증은 [주제별 전환 기록](../events/2026-10-30-themed-artwork-transition.md)에 확인한 범위를 기록한다. 지난 버전 검증은 [기존 Storage 검증](../events/2026-10-29-artwork-verification.md)에 보존한다.

## 2026-10-30 전환 상태

공유 서버에 `20261029160457_themed_artwork_library`를 반영하고 핼러윈·겨울 주제 PNG 4개와 라이브러리 정의를 등록했다. 공개 다운로드 해시·규격, 기존/신규 RPC와 보유·이력 보존을 확인했다. 이번 지원 코드의 테스트 앱 게시를 완료했다. 휴대폰에서 프로필 → 앱 업데이트 → 적용하기 후 확인한다. 실제 기기 적용 결과는 전환 기록에 남긴다.
