# 서버 배경·스킨 이미지 운영

상태: 코드 구현·격리 검증 완료 / 공유 서버 반영·실제 Storage 업로드 검증 대기 / 앱 미배포

이미지 파일은 Supabase Storage의 `event-artwork` 버킷에, 표현 정의와 게시 리비전은 서버 DB에 저장한다. 효과 실행 코드는 앱에 남기고 기존 `warmSteam` 종류와 화면별 위치·폭·투명도를 설정한다. 새 효과 동작·새 캐릭터·새 콘텐츠 스키마는 코드 업데이트가 필요하다.

## 현재 반영 상태

- `remote_event_artwork` 마이그레이션과 업로드·검증·게시 CLI, 앱 원격 이미지 표시를 구현했다.
- 공유 서버 적용은 자동 승인 검토에서 새 버킷·스키마·권한·예약 구조의 영구 변경에 명시적 승인이 필요하다는 이유로 거절돼 보류했다. 우회 반영하지 않았다.
- 이전 이벤트 예약 서버는 이미 반영된 상태다. 이번 이미지 전환이 적용됐다는 뜻은 아니다.
- 실제 파일 업로드·Storage 다운로드·실제 서버 원격 이미지 RPC는 아직 검증하지 않았다. Storybook의 로컬 HTTP 시나리오와 실제 Storage 검증을 구분한다.
- 앱 배포·운영방 지급·실제 행사 예약은 수행하지 않았다.

## 최초 준비

1. 공유 서버 반영 승인 후 현재 스키마·마이그레이션 이력을 확인하고 원격 이미지 마이그레이션만 적용한다. 기존 데이터 초기화나 앞선 마이그레이션 재실행은 하지 않는다.
2. 버킷은 공개 가능한 꾸미기 PNG만 읽기 공개한다. 개인 정보·명단·비밀 키는 업로드하지 않는다. 앱 사용자의 업로드·수정·삭제 정책은 만들지 않으며 신뢰된 운영 자격만 쓴다.
3. 실제 이미지 업로드·해시 확인과 자기 보유/같은 방 친구의 착용 스킨 조회·다른 방 거부를 검증한다. 새 등록은 비활성으로 먼저 확인한다.
4. 지원 코드를 EAS 업데이트로 전달하고 사용자 적용을 확인한다. 새 네이티브 의존성·앱 버전 변경은 이번 구현에 없다. 실제 배포는 [릴리스 절차](RELEASES.md)를 따른다.
5. 이후 같은 규격의 새 이미지와 기존 효과 설정은 서버 등록·게시·예약으로 운영한다. 최초 지원 업데이트 이전 앱은 로컬 이미지 또는 기본 이미지로 대체한다.

## 이미지와 정의

- PNG 한 파일 최대 5 MiB, 두 파일 합계 최대 10 MiB.
- 홈: 1536×1024. 스킨 집중: 1254×1254. 배경 집중: 1024×1536.
- 8비트 RGB/RGBA·비인터레이스 PNG를 사용한다. 스킨은 실제 투명 픽셀이 있는 RGBA여야 한다.
- 운영 도구가 PNG 서명·청크 CRC·압축 데이터·규격·투명도를 검사한다. 업로드 후 공개 주소에서 읽은 바이트 크기·SHA-256도 대조한다.
- 파일 경로는 `<skin|background>/<콘텐츠 ID>/<리비전 UUID>/<home|focus>.png`다. 같은 경로를 다른 파일로 덮어쓰지 않는다.
- 두 파일을 확인하기 전에는 표현 정의를 초안으로도 등록하지 않는다. 초안 등록과 실제 게시를 구분한다.

입력 정의 예시:

```json
{
  "schemaVersion": 1,
  "revision": "새 UUID로 교체",
  "kind": "skin",
  "id": "bunny-winter",
  "name": "겨울 토끼",
  "character": "bunny",
  "homePlacement": { "scale": 0.72, "x": 768, "y": 860 },
  "focusBottom": 1154,
  "effects": [
    {
      "kind": "warmSteam",
      "home": { "x": 0.5, "y": 0.2, "width": 0.1, "opacity": 0.5 },
      "focus": { "x": 0.5, "y": 0.2, "width": 0.1, "opacity": 0.5 }
    }
  ]
}
```

배경은 `kind: "background"`로 하고 캐릭터·스킨 배치·효과 설정을 생략한다. 효과는 스킨당 최대 3개다. 현재 위치는 0~1, 폭은 0.01~0.5, 투명도는 0~1이다. 색·속도·입자 수 등 현재 렌더러에 없는 매개변수는 등록을 거부한다.

## 운영 CLI

`SUPABASE_URL`(또는 공개 URL 환경 변수)과 비공개 `SUPABASE_SERVICE_ROLE_KEY`를 신뢰된 운영 환경에서 사용한다. 키를 명령 인자·정의 JSON·문서에 넣지 않는다.

```sh
# 업로드 없이 파일 검사와 완성된 manifest 생성
node --experimental-strip-types supabase/scripts/manage-artwork.mjs prepare --definition /private/tmp/skin-definition.json --home HOME.png --focus FOCUS.png --out /private/tmp/skin-manifest.json

# 파일 업로드·실제 해시 확인·초안 등록 (게시하지 않음)
node --experimental-strip-types supabase/scripts/manage-artwork.mjs upload --definition /private/tmp/skin-definition.json --home HOME.png --focus FOCUS.png

# 비공개 자격 없이도 업로드된 두 파일의 해시 확인 가능
node --experimental-strip-types supabase/scripts/manage-artwork.mjs verify --definition /private/tmp/skin-manifest.json

# 정의 게시. --activate를 명시한 경우에만 새 콘텐츠의 지급/예약을 활성화
node --experimental-strip-types supabase/scripts/manage-artwork.mjs publish --revision REVISION_UUID --activate

node --experimental-strip-types supabase/scripts/manage-artwork.mjs list --revision REVISION_UUID
```

부분 실패나 응답 유실에는 같은 입력·리비전으로 재시도한다. 이미 파일이 존재하면 같은 해시인지 확인하고 다르면 중단한다. 업로드·등록이 실패한 상태를 게시 완료로 보고하지 않는다. 파일 준비·게시만으로 스킨을 지급하거나 이벤트를 예약하지 않는다.

서비스 키가 없고 연결된 Supabase 도구와 인증된 CLI가 있으면, `prepare`로 검증한 파일을 Storage CLI로 **비어 있는 새 리비전 경로에만** 올리고 `verify` 후 아래 RPC를 호출할 수 있다. 기존 객체가 있으면 덮어쓰지 말고 먼저 원본 해시를 대조한다. CLI의 실제 `storage cp --help`를 확인한다. 프로젝트 ref와 저장 경로를 반드시 확인하고 자격 값을 출력하지 않는다.

| RPC | 용도 |
| --- | --- |
| `admin_stage_artwork(p_definition jsonb)` | 업로드된 두 파일과 정의 확인 후 불변 초안 등록 |
| `admin_publish_artwork(p_revision uuid, p_activate boolean)` | 검증된 리비전 게시·필요시 활성화 |
| `admin_artwork_report(p_revision uuid 또는 NULL)` | 초안·게시 리비전과 현재 게시 포인터 확인 |
| `get_skin_artwork(p_ids text[], p_room_id smallint)` | 사용자용. 최대 32개 ID, 자기 보유 또는 같은 방의 착용 스킨만 반환 |

게시 후 배경 예약과 스킨 지급은 [기존 이벤트 운영 도구](EVENT-OPERATIONS.md)를 사용한다. 방별 배경 예약은 당시 리비전을 고정한다. 날짜만 변경할 때도 유지하고, 표현을 바꾸려면 새 리비전을 명시한다. 스킨은 보유·착용 ID를 유지하면서 게시된 표현을 갱신한다. 지급 작업에는 당시 리비전 참조도 남는다.

잘못 게시한 스킨은 과거 리비전을 다시 게시해 복구할 수 있다. 이미 예약된 배경은 고정 참조이므로 게시 포인터만 바꿔서는 변경되지 않는다. 해당 예약의 리비전 변경 또는 중단 요청을 별도로 처리한다. 과거 파일·리비전·행사 기록은 보존한다.

## 앱 표시와 실패 처리

화면에 필요한 스킨과 현재·다음 배경만 요청한다. 중복 다운로드를 공유하고 이미지 준비 동시 실행은 최대 4개로 제한한다. 메타데이터는 사용자·방별로 저장하며 이미지 캐시는 플랫폼 기능을 사용한다. 새 네이티브 캐시 모듈은 추가하지 않는다.

두 이미지의 다운로드·크기 확인 전에는 새 원격 스킨을 적용 가능으로 표시하지 않는다. 실패 시 재시도와 기본 이미지 대체를 제공한다. 이전 정상 리비전이 있으면 새 리비전의 준비가 끝날 때까지 유지한다. 알 수 없는 효과는 생략하고 지원되는 이미지는 표시한다.

오프라인 캐시는 OS·브라우저가 비울 수 있다. 캐시가 없으면 기본 이미지로 표시하고 서버의 보유·착용 상태는 유지한다. 배경은 알려진 종료 시각 이후 기본 배경으로 돌아간다. 다운로드가 공부 시작·중지나 저장을 막지 않는다.

## 검증

```sh
npm run lint
npm run typecheck
npm test
node supabase/scripts/check-artwork-db.mjs ABSOLUTE_PATH_TO_PGLITE/dist/index.js
node supabase/scripts/check-events-db.mjs ABSOLUTE_PATH_TO_PGLITE/dist/index.js
node supabase/scripts/check-skins-db.mjs ABSOLUTE_PATH_TO_PGLITE/dist/index.js
npm run build-storybook
```

격리 DB는 Storage와 Cron의 대체 구현이다. Storybook의 `Events/RemoteArtwork`는 로컬 HTTP 이미지로 원격 전용 ID와 실패 표시를 검증한다. 실제 Supabase 업로드·권한·네이티브 기기·iPhone 웹앱 검증 완료로 해석하지 않는다.

## 2026-10-29 코드 검증 결과

- 린트·타입 검사, 전체 단위 테스트 368개, 원격 이미지·기존 이벤트·스킨 격리 DB 검사와 스킬 형식 검사를 통과했다.
- Storybook 빌드를 완료하고 로컬 HTTP 이미지로 홈·집중의 원격 전용 스킨 ID, 배경, warmSteam 설정과 보유 목록을 확인했다. 이미지 준비 중 선택 제한, 준비 후 적용 버튼 활성화, 실패 시 기본 이미지 대체도 확인했다.
- 현재·다음 배경만 반환하는 제한과 예약 리비전 고정을 격리 DB에서 검증했다. 사용자 전환·늦은 캐시·오프라인 응답 경합도 검증했다.
- 실제 Supabase Storage 업로드·다운로드와 원격 이미지 RPC는 새 서버 반영 승인을 받은 뒤 검증한다. Android 실기기·iPhone 웹앱 표시는 아직 미검증이다.
