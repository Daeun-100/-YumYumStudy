# 클라우드 빌드 실행 안내

2026-10-27 설정 및 첫 클라우드 실행 기록. 현재 완료 상태와 이후 실행 방법을 정리한다.

## 현재 완료 상태

- `develop`을 GitHub에 업로드했고 draft PR #1에 앱·빌드 설정을 모았다.
- GitHub repository secret `EXPO_TOKEN` 등록을 확인했고 클라우드 웹 배포에서 실제 인증에 성공했다.
- GitHub 공개 Variables 3개와 Expo preview/production Supabase 공개값 등록 완료.
- master에는 실행 메뉴용 cloud-build.yml만 최초 등록했다. 친구용 앱 소스 전체는 아직 병합하지 않았다.
- master 보호(PR 필수·check 성공 필수·직접 push 제한)와 production 공개 시 본인 승인 설정 완료.
- test / production Android 앱 ID에 각각 서명 키 생성 완료. 키는 EAS에 보관하며 저장소에 넣지 않았다.
- 첫 클라우드 실행: https://github.com/Daeun-100/-YumYumStudy/actions/runs/40371426268
- 첫 테스트 웹: https://yumyumstudy-daeun100--test-fe11f120debb-1-1.expo.app
- 첫 테스트 웹 생성 성공. APK는 Expo에 접수됐으며 마지막 확인 시 무료 대기열에 있다.
- Expo APK 빌드 ID: `3f20c141-08c0-499c-a0cb-0ac5febefc08`.
- 로컬 캐시 없는 코드 검사·타입 검사·테스트 61개 통과. 클라우드 prepare 검사도 통과.
- 실제 APK 설치·실기기 확인·친구용 공개는 아직 남아 있다. 업데이트 안내도 켜지 않았다.

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

## 최초 한 번 필요한 외부 설정 (재설정 시 참고)

현재 적용 여부는 위 완료 상태를 기준으로 본다. 아래는 처음 연결할 때의 절차다.

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
6. test / production 각 Android 앱 ID에 EAS 서명 키 생성 완료. 새 프로젝트를 다시 설정한다면 키가 준비되어야 한다. 첫 클라우드 빌드에서 대화형으로 초기 설정한다.
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

후보 웹과 APK 설치를 확인한 뒤 GitHub Releases에서 해당 Draft의 **Publish release**를 누른다.
`Publish Friend Release`가 production 환경 승인 뒤 실행된다. 기존 본인 승인 정책은 유지되므로
Actions 실행 화면에서 **Review deployments → Approve and deploy**가 추가로 필요할 수 있다.

1. 태그가 master에 포함된 코드인지, 앱 버전/빌드 번호, 성공한 Cloud Build 실행과 APK SHA-256을 검증한다.
2. Supabase 인증 및 기존 공개 버전보다 낮지 않은지 확인한다.
3. 이미 만든 웹 후보를 고정 주소에 연결한다. 다시 빌드하지 않는다.
4. Supabase `app_releases`의 Android·웹 두 행을 한 요청으로 등록하고 활성화한다.
5. Android 다운로드 주소는 공개 Release에 첨부한 APK의 고정 링크를 사용한다.

Prerelease, 테스트 빌드, APK 없는 수동 Release, 다른 코드로 옮긴 태그, 이전 버전은 자동 공개하지 않는다.
이 자동화 도입 전에 생성한 후보에는 `candidate.json`이 없으므로 새로운 Cloud Build 후보가 필요하다.
웹 반영 후 Supabase 등록이 실패하면 웹은 이미 공개됐을 수 있다. Actions의 실패한 작업을 재실행한다.
같은 버전·주소로 재실행하는 것은 허용하고 이미 공개된 더 높은 빌드로의 역행은 차단한다.
Release 자체는 Publish 클릭 시 먼저 공개되므로 Actions 실패가 GitHub Release 공개까지 취소하지는 않는다.

**활성화 준비:** 이 워크플로와 스크립트를 master에 병합하고 GitHub `production` Environment secret에
`SUPABASE_RELEASE_SECRET_KEY`를 등록한다. 해당 Supabase 프로젝트의 서버용 `sb_secret_...` 키
또는 legacy `service_role` 키를 사용한다. 공개 publishable/anon 키로는 등록할 수 없다.
서버용 키는 DB의 RLS를 우회하므로 앱의 EXPO_PUBLIC 변수·Git·채팅에 넣지 않는다.
URL은 기존 repository variable `EXPO_PUBLIC_SUPABASE_URL`을 재사용한다.
Release 태그 `v*`가 production 환경에서 허용되어야 한다.

기존 `Publish Verified Web` 수동 작업은 웹만 반영하는 복구/별도 공개용으로 남아 있으며
Supabase를 변경하지 않는다. APK·웹을 함께 공개할 때는 Release 공개 흐름을 사용한다.
실제 초대 코드는 별도로 등록해야 신규 친구가 입장할 수 있다.

## 검증 범위

- 코드·타입 검사와 자동 테스트, test / production 웹 export를 검증한다.
- EAS 실제 APK 빌드, Hosting 후보 생성, GitHub 수동 실행과 branch protection은 외부 연결 후 추가 검증 필요.
- Expo 계정 로그인만으로 GitHub Actions가 인증되는 것은 아니다.
