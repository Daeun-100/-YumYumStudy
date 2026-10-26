# 클라우드 빌드 실행 안내

2026-10-27 설정 작업 기록. 자동화 파일과 앱 환경 구분은 구현했으며 아래 외부 연결이 끝나야 실제 빌드를 실행할 수 있다.

## 현재 완료 상태

- 로컬 `develop` 브랜치에 앱/빌드 설정을 커밋했다. GitHub push는 컴퓨터의 Git 로그인 부재로 미완료다.
- GitHub 공개 Variables 3개(Supabase URL/공개 키, EAS_HOSTING_DOMAIN)를 저장했다.
- Expo preview/production의 Supabase 공개값은 등록했다.
- EXPO_TOKEN은 아직 발급/등록하지 않았다. GitHub 연결 인증과 함께 승인 후 이어서 처리한다.
- test/production 웹 export, 코드/타입 검사, 자동 테스트를 통과했다.
- 릴리스 모드 테스트 웹에서 0번 → 1번 전환 시 실제 초대 코드 모달이 뜨는 것을 확인했다.
- APK 서명 초기화·실제 클라우드 실행·master 반영·브랜치 보호·공개 승인 환경 설정은 아직 남아 있다.

## 실행 경로

```text
develop → Actions / Cloud Build / Run workflow → target=test
        → 테스트 APK + 테스트 웹 미리보기 → 0번·1번 선택

master 병합 → Cloud Build 자동 실행
           → 친구용 APK + 친구용 웹 후보 → 1번 고정
           → 휴대폰에서 확인
           → Publish Verified Web 수동 실행 → 확인한 웹 후보를 고정 주소에 공개
```

친구들에게 APK 링크를 공유하거나 Supabase 업데이트 안내를 켜는 것은 별도 확인 후 한다.
Cloud Build는 공개 웹 고정 주소나 app_releases를 자동 변경하지 않는다.

## 추가한 설정

- `eas.json`: test / production APK 프로필, Node 22, CLI 25.3.0 고정, 커밋되지 않은 소스로 APK 빌드 차단.
- `app.config.js`: 테스트 앱은 `com.yumyumstudy.app.test`, 친구용은 기존 `com.yumyumstudy.app`. 두 앱을 함께 설치 가능.
- 공개 앱 환경값 `EXPO_PUBLIC_APP_VARIANT=test|production`으로 테스트 기능을 구분. `__DEV__`만으로 판단하지 않는다.
- 테스트 버전에서 0번·1번 선택 가능. 기본은 0번. 방별 로그인 키와 클라이언트를 분리하고 화면을 다시 초기화한다.
- 타이머 실행 중, 미확인 공부·연차 요청, 인증/서버 요청 처리 중에는 방 변경 차단.
- 실제 1번 방은 기존 초대 확인을 그대로 거친다. 테스트 앱에도 실제 방 입장을 우회하는 권한은 없다.
- `.easignore`는 npm 잠금 파일을 사용하도록 pnpm 잠금 파일을 빌드 업로드에서 제외한다. 로컬 pnpm 파일은 삭제하지 않는다.
- PR 검사: 코드/타입/테스트/웹 export, master 대상 PR의 버전 검증.
- 클라우드 빌드: 브랜치를 검증한 뒤 전체 커밋 SHA를 고정해서 각 빌드에 전달한다.
- APK는 실제 EAS 완료까지 기다린다. 결과 JSON과 실패 시 결과도 Actions artifact에 보관한다.
- 웹은 `production-커밋앞12자리-실행번호-시도번호` 또는 `test-...` 후보 주소로 생성한다.
- Android·웹 모두 성공하면 친구용 버전 태그를 만들고 GitHub의 draft release에 결과 기록을 첨부한다.

## 최초 한 번 필요한 외부 설정

1. `develop`에 현재 앱과 설정을 커밋·push한다.
2. 이 워크플로 파일들을 기본 브랜치 `master`에 PR로 반영해야 Actions의 수동 실행 메뉴가 등록된다.
   master의 자동 빌드는 아래 인증/서명 설정이 준비되지 않으면 실패하므로 최초 반영 전에 준비한다.
3. GitHub Actions repository secret `EXPO_TOKEN`을 등록한다. Expo 계정에 접근할 수 있는 비밀 인증값이며
   공개 Variables나 소스에 넣지 않는다. 새 인증키 발급·연결은 사용자 승인 후 수행한다.
4. GitHub Actions Variables에 다음 공개값을 등록한다.
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `EAS_HOSTING_DOMAIN`: 예를 들어 `yumyumstudy-daeun100` (최초 EAS Hosting 생성 시 사용 가능 여부 확인 필요)
5. Expo preview/production 환경에 같은 Supabase 공개값을 등록한다. 이 항목은 등록 완료했다.
6. test / production 각 Android 앱 ID에 EAS 서명 키가 준비되어야 한다. 첫 클라우드 빌드에서 대화형으로 초기 설정한다.
   서버에서 만드는 EAS 빌드이며 컴퓨터에서 APK를 컴파일하는 뜻이 아니다. production 키는 이후 교체하지 않는다.
7. GitHub `production` Environment를 만들고 공개 작업에 필요한 승인자를 지정한다.
   승인자가 없으면 수동 Publish Verified Web 실행 자체만으로 공개가 진행된다.
8. master 보호 규칙: PR 필수, Check / check 성공 필수, 직접 push 차단.
   혼자 관리하는 저장소이므로 다른 사람 1명의 PR 승인을 필수로 하면 병합이 막힐 수 있다.

## 개발 중 테스트 빌드

Actions → Cloud Build → Run workflow → branch `develop` → target `test`.
APK와 웹 결과는 해당 실행의 Artifacts에서 확인한다. 매 push마다 빌드하지 않는다.

테스트 앱은 독립 앱 ID이므로 친구용 앱과 별도 사용자로 1번 방에 참여할 수 있다.
이름과 데이터는 실제 방에 저장된다. 기존 친구용 UID를 테스트 앱으로 자동 이전하지 않는다.

## 친구용 후보와 공개

배포 PR에서 `app.json` version/versionCode와 package.json version을 올린다.
`master` 병합 시 후보를 만든다. 첫 버전은 1.0.0 / 1, 이후에는 둘 다 증가해야 한다.
`node scripts/check-release.mjs`가 기존 태그와 비교하여 같은 버전을 다른 코드에 재사용하지 못하게 한다.

후보를 확인한 뒤 Actions → Publish Verified Web → branch `master` → 확인한 production 후보 ID 입력.
이미 만든 결과를 production alias에 연결하므로 공개 시 다시 빌드하지 않는다.
테스트 ID는 이 작업으로 production에 연결할 수 없다.

APK 다운로드·설치 확인 후 링크를 친구에게 공유한다. 공개 배포를 완료한 플랫폼만
Supabase app_releases를 갱신한다. 실제 초대 코드는 별도로 등록해야 신규 친구가 입장할 수 있다.

## 검증 범위

- 코드·타입 검사와 자동 테스트, test / production 웹 export를 검증한다.
- EAS 실제 APK 빌드, Hosting 후보 생성, GitHub 수동 실행과 branch protection은 외부 연결 후 추가 검증 필요.
- Expo 계정 로그인만으로 GitHub Actions가 인증되는 것은 아니다.
