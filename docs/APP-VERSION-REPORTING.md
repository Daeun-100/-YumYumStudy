# 사용자별 마지막 확인 버전

사용자 한 명당 `public.user_app_versions` 한 행을 유지한다. 앱 설치 ID나 기기 목록은 만들지 않는다.
다른 환경에서 보고하면 그 사용자의 직전 관측값을 덮어쓴다. 접속 이력이나 현재 온라인 여부를 의미하지 않는다.

## 앱 동작

- `AppVersionReporter`는 로그인·초대·이름 설정이 완료되고 앱이 활성화된 뒤 보고한다.
- 최초 진입, 네이티브 foreground, 웹 visibility/online 복귀에 연결한다. 주기 타이머는 없다.
- 같은 실행 내 사용자·방별 중복 요청을 합치고, 성공한 동일 버전은 15분 동안 재전송하지 않는다.
- 버전이 바뀌면 즉시 보고한다. 실패는 성공으로 캐시하지 않아 다음 복귀 때 재시도한다.
- 5초 뒤 요청을 취소한다. 화면 표시나 공부 기능은 응답을 기다리지 않는다.
- 개발 실행은 제외한다. 테스트 배포는 `app_variant = test`로 구별한다.
- Android/iOS의 설치 버전은 `expo-application`, 실행 중인 코드 ID는 `expo-updates`에서 읽는다.
  APK 내장 코드인지도 `embedded`에 저장한다. 다운로드만 된 업데이트를 보고하지 않는다.
- 모듈이 없는 구형 APK에서는 네이티브 버전 읽기 실패를 처리하고 보고를 생략한다. 앱 구동을 막지 않는다.
- 웹은 `EXPO_PUBLIC_BUILD_SHA`를 export 시 코드에 삽입한다. 배포 workflow는 고정된 입력 커밋을 전달한다.
  SHA가 없거나 유효하지 않은 웹 빌드는 보고하지 않는다. 웹에는 APK 빌드 번호를 붙이지 않는다.

## 서버

`20261029025831_user_app_versions.sql`은 2026-10-29 운영 프로젝트에 적용했다.
CLI로 생성한 마이그레이션 파일명은 MCP 적용 후 서버가 기록한 실제 버전으로 맞췄다.

`report_app_version`은 사용자 ID를 인자로 받지 않고 `auth.uid()`를 사용한다.
`SECURITY INVOKER`와 본인 행 RLS를 적용하며 `current_study_room()`으로 입장 완료를 확인한다.
일반 사용자는 다른 사람의 행을 조회·수정하거나 행을 삭제할 수 없다.
테이블 직접 접근에서도 제약조건을 적용하고 trigger가 `last_seen_at`을 서버 시각으로 덮어쓴다.
익명 **인증 계정**을 사용하는 기존 앱 구조이므로, 입장 완료한 인증 계정의 본인 행 접근은 의도된 정책이다.
[Supabase 익명 인증 정책 안내](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins)

## 관리자 조회

관리자 SQL 연결 또는 Supabase MCP에서 실행한다. 일반 앱에 관리자 키나 전체 멤버 조회 권한을 추가하지 않는다.

```sql
select p.display_name, v.platform, v.app_variant,
       v.app_version, v.build_version, v.update_id,
       v.runtime_version, v.embedded, v.web_build_id,
       v.last_seen_at at time zone 'Asia/Seoul' as last_seen_kst
from public.profiles p
left join public.user_app_versions v on v.user_id = p.id
where p.room_id = 1
  and p.invite_verified_at is not null and p.name_confirmed
order by p.display_name, p.id;
```

NULL 기록은 '확인 기록 없음'으로 표시한다. 마지막 확인 이후 앱을 열지 않은 사용자를 최신으로 추정하지 않는다.
업데이트 ID는 기존 GitHub revision Release의 `update-record.json`에 저장된 `updateId`와 연결해
`v1.0.2-rN`으로 해석할 수 있다. 별도의 배포 매핑 테이블은 만들지 않는다.
내장 실행은 APK 버전으로, 웹은 빌드 커밋으로 구별한다. 이 기능은 앱 버전이나 revision 태그를 변경하지 않는다.

## 검증 및 배포

- `npm run lint`, `npm run typecheck`, `npm test`.
- `supabase/tests/user_app_versions.sql`은 운영 DB에서 트랜잭션 후 rollback으로 권한·덮어쓰기·시각·입장 검증을 수행했다.
  입장이 완료된 기존 프로필 두 명을 사용하되 테스트 관측값은 보존하지 않는다.
- Web export와 Android JS/Hermes export를 검증한다. APK 설치·실기기 실행 검증과는 구분한다.
- `expo-application`은 기존 lockfile에도 전이 의존성으로 있던 동일 버전을 직접 선언했다.
  실제 운영 APK 포함 여부 및 OTA 호환성은 릴리스 검토에서 확인해야 한다.
  기존 배포 검사는 package/lockfile 변경을 보수적으로 APK 경로로 분류하므로 이를 우회하지 않는다.
- 운영 앱 코드는 기존 develop → master 검토·배포 경로를 따른다. DB 적용만으로 기존 앱이 보고를 시작하지 않는다.
