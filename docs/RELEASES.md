# 버전 및 업데이트 운영

초기 버전은 `1.0.0`, 배포 번호는 `1`이다. `app.json`의 `expo.version`은 표시용, `expo.android.versionCode`는 Android와 웹 공통 배포 번호다. package.json version도 표시 버전과 맞춘다. 매 배포마다 배포 번호를 증가시키며 같은 번호로 다른 코드를 배포하지 않는다. 버전 숫자 문자열이 아니라 배포 번호로 새 버전 여부를 판단한다.

## 사용자 동작

- 실행 시, 화면 복귀 시, 화면이 켜져 있는 동안 60초마다 Supabase의 공개 배포 정보를 확인한다.
- 현재 빌드보다 높은 배포 번호가 활성화되어 있으면 앱 안에 업데이트 안내를 표시한다. `나중에`는 현재 실행 중 해당 배포 안내만 닫는다.
- Android는 HTTPS APK 다운로드 주소를 연다. 사용자가 직접 설치하며 동일 패키지 ID·동일 배포 서명·더 높은 versionCode가 필요하다.
- 웹은 사용자가 새로고침을 눌러 새 코드를 받는다. 자동 새로고침으로 작업을 끊지 않는다. 호스팅에서 index.html을 재검증하도록 설정하고 새 정적 파일을 배포해야 한다.
- 앱이 꺼져 있을 때의 OS 푸시, 강제 업데이트, 자동 APK 설치, OTA 업데이트는 포함하지 않는다.
- 확인 실패는 최신 버전으로 오인하지 않고 오류와 다시 확인을 표시한다. 업데이트 서버 장애로 공부 기능을 막지 않는다.

## 최초 DB 준비

`supabase/migrations/010_app_releases.sql`을 Supabase SQL Editor 또는 마이그레이션 도구로 한 번 적용한다. Android/웹 각각 한 줄만 사용하며 초기에는 `enabled=false`라 알림을 보내지 않는다.

`app_releases`는 공개 배포 메타데이터다. 로그인 전에도 공개 키로 활성화된 행을 읽을 수 있도록 예외적으로 anon SELECT를 허용한다. API 사용자는 수정할 수 없다. UID/공부 기록을 넣지 않는다. 수정은 관리자 대시보드나 신뢰할 수 있는 서버에서만 한다. 공부 데이터의 본인 수정 RLS와 별개다.

## 기능 추가 후 알림을 보내는 순서

1. app.json의 version과 versionCode, package.json version을 증가시킨다.
2. 검사 후 코드를 커밋한다. 배포 산출물을 만들고 해당 커밋에 `v1.0.1` 같은 태그를 붙인다. 태그 생성은 릴리스 담당자가 수행한다.
3. Android APK를 올리고 실제 다운로드·업데이트 설치를 확인한다. 웹은 HTTPS 호스팅에 배포하고 새 배포 번호가 들어갔는지 확인한다.
4. **배포 확인 후** Supabase Table Editor의 `app_releases`에서 대상 platform의 revision/version/notes/download_url을 한 번에 갱신하고 enabled를 true로 저장한다. 이것이 작성자가 주는 업데이트 신호다.
5. 기존 버전에서 안내가 뜨고 새 버전에서는 사라지는지 확인한다. 알림만 취소하려면 enabled를 false로 바꾼다. 설치된 버전이 자동으로 롤백되지는 않는다.

예: Android 행을 revision `2`, version `1.0.1`, 실제 APK의 HTTPS 주소, 변경 설명, enabled `true`로 저장한다. 웹은 별도 행에서 활성화하며 download_url은 null로 둬도 된다.

실제 새 APK/웹 주소가 준비되지 않은 상태에서 enabled를 켜지 않는다. 이 알림 기능이 없는 이전 APK에는 안내를 소급해서 표시할 수 없으므로 첫 친구 배포부터 포함한다.

## 검사

`npm test`는 더 높은 배포 번호만 알리는지, 플랫폼 구분, 잘못된 URL 거부, 조회 오류와 최신 버전 구분을 검사한다. `npm run lint`, `npm run typecheck`, `npm run export:web`도 실행한다. 원격 적용·실기기·업데이트 설치의 실제 검증 여부는 SETUP-STATUS.md에 따로 기록한다.
