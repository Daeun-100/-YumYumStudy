# 캐릭터 이벤트 스킨 운영

이미지는 앱에 포함하고, 서버는 이벤트 스킨 정의와 사용자별 보유 내역, 현재 착용 상태를 관리한다. 관리자 화면 없이 신뢰할 수 있는 운영 환경에서 등록·지급·적용한다.

## 서버 반영

2026-10-28 실제 서버 반영과 검증을 완료했다. 적용된 버전은 `20261028125054_character_event_skins`, `20261028125307_index_profile_skin`이며 로컬 파일명도 서버 이력과 맞췄다. 지급·착용 검증은 테스트방 프로필로 실행 후 롤백했다. 현재 `bunny-toothache`는 지급 비활성, 보유 내역과 착용자는 0명이다. 앱 배포는 별도다.

마이그레이션은 `supabase/migrations/20261028125054_character_event_skins.sql`이다. `character_skins`, `user_skins` 두 테이블과 `profiles.active_skin_id`, `profiles.skin_updated_at`을 추가한다. 관리자 작업 기록 테이블은 없다.

기존 프로필 응답에 필드를 추가하는 방식이며 기존 앱은 추가 필드를 무시할 수 있다. 앱보다 서버 변경을 먼저 반영한다. 기존에 적용된 레거시 마이그레이션 이력을 확인한 뒤 이번 파일만 적용하고, 기존 테이블이 있는 서버에 전체 초기화 명령을 실행하지 않는다.

기본 등록 스킨은 `bunny-toothache`이며 지급은 비활성 상태로 시작한다. 코드에는 승인된 치통 토끼 홈·집중 에셋을 연결한다. 실제 배포 APK와의 호환성을 확인하고 OTA 전달을 검증한 뒤 지급을 활성화한다.

## 운영 도구

`supabase/scripts/manage-skins.mjs`는 서버 운영 전용이다. 환경 변수 `SUPABASE_URL` 또는 `EXPO_PUBLIC_SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 필요하다. 서비스 키를 Expo 공개 환경 변수, 앱 코드, 커밋, 명령 인자에 넣지 않는다.

```sh
# 전체 스킨 목록
node supabase/scripts/manage-skins.mjs catalog

# 테스트방 사용자 목록. 운영방은 --room 1을 명시한다.
node supabase/scripts/manage-skins.mjs members --room 0

# OTA 확인 후 지급 활성화
node supabase/scripts/manage-skins.mjs enable --skin bunny-toothache

# 지급만 하기
node supabase/scripts/manage-skins.mjs grant --room 0 --user USER_UUID --skin bunny-toothache

# 지급과 동시에 적용. 캐릭터도 토끼로 바뀐다.
node supabase/scripts/manage-skins.mjs grant --room 0 --user USER_UUID --skin bunny-toothache --apply

# 이미 보유한 스킨 적용
node supabase/scripts/manage-skins.mjs apply --room 0 --user USER_UUID --skin bunny-toothache

# 현재 캐릭터의 기본 모습으로 돌아가기
node supabase/scripts/manage-skins.mjs reset --room 0 --user USER_UUID

# 새 스킨 정의 등록. 기본은 지급 비활성 상태다.
node supabase/scripts/manage-skins.mjs register --skin SKIN_ID --name SKIN_NAME --character bunny
```

`--user`에는 닉네임 대신 사용자의 UUID를 사용한다. 테스트방과 운영방을 혼동하지 않도록 지급·적용에는 `--room`이 필수다. 선택적으로 `--by ADMIN_UUID`를 지급 시 지정할 수 있으며, 생략하면 지급자 값은 비어 있다. 지급 시각은 항상 저장되고 중복 지급 시 최초 지급 정보는 유지된다.

`disable --skin SKIN_ID`는 신규 지급만 중지한다. 이미 보유한 사용자는 계속 적용할 수 있다. 기존 스킨 ID와 소속 캐릭터는 변경하지 않는다.

## 새 이미지 추가

1. 홈·집중 PNG를 에셋에 추가한다.
2. `src/design/skin-artwork.ts`에 고유 ID, 캐릭터, 이미지 연결을 추가한다. 기본과 여백이 다르면 배치 보정값도 지정한다.
3. 공유 스토리북과 홈·집중 화면에서 비율과 위치를 확인한다.
4. 서버에 같은 ID로 지급 비활성 스킨을 등록한다.
5. OTA 배포와 수신 확인 후 지급을 활성화한다.

목록 미리보기는 집중 이미지를 사용한다. 기본 캐릭터는 보유 목록에 표시하지 않는다. 앱이 아직 모르는 스킨은 기본 이미지와 업데이트 안내로 표시하며 서버의 선택 상태를 초기화하지 않는다.

## 검증

- `npm run lint`, `npm run typecheck`, `npm test`
- `npm run build-storybook`
- 격리 PostgreSQL 검증: 임시 환경에 `@electric-sql/pglite`를 설치한 뒤 `node supabase/scripts/check-skins-db.mjs ABSOLUTE_PATH_TO_PGLITE/dist/index.js`

격리 검증은 기존 앱 마이그레이션을 순서대로 재생하고 지급·착용·해제, 중복 지급, 기본 캐릭터 변경, 응답 전파, 권한 제한을 검사한다. 외부 cron·Vault와 Realtime 전송은 대체 환경이므로 이 검증으로 실제 Supabase Realtime 연결이나 Android 기기 화면까지 확인했다고 판단하지 않는다.
