# 얌얌스터디

구현 원칙: **최대한 간단하게.** 현재 MVP에 필요한 기능과 최소 구조를 우선한다. 구체적인 기준은 [설계 문서](docs/development/ARCHITECTURE.md)에 기록한다.

4명이 공부 목표와 기록을 공유하는 앱. Android는 APK, iPhone은 Safari 웹앱으로 사용한다.

첫 접속에는 초대 코드 확인과 이름 설정을 거쳐 고정 방에 참여하며, 이후에는 저장된 익명 UID로 자동 입장한다. 뒤에서 자동 익명 인증으로 UID를 발급해 기록을 구분하고 이름은 표시용으로 사용한다. 저장소 삭제·기기 변경 시 UID가 달라질 수 있으며 MVP에서는 이전·복구를 제공하지 않는다.

기본 타이머는 화면 이탈·잠금 후에도 시간을 누적하고 직접 중지하면 종료한다. Android 허용앱 모드는 이탈 시 일시정지하는 별도 규칙을 사용한다. 자세한 동작은 [상세 기능 정책](docs/product/FEATURE-POLICIES.md)을 따른다.

## 개발 시작

- Node.js 22 LTS, npm 사용 (`.nvmrc` 참고)
- `npm ci` — 잠금 파일 기준 설치
- `npm run web` — 웹 개발 서버
- `npm run web:iphone` — 웹 서버와 iPhone 시뮬레이터 Safari를 한 번에 실행 (Xcode·iOS 런타임 설치 후)
- `npm run android` — Android 개발 실행 (에뮬레이터 또는 연결된 기기 필요)
- `npm run typecheck` — TypeScript 검사
- `npm run lint` — Expo ESLint 검사
- `npm test` — UID 복원·동시 초기화·날짜 경계·표시 시계·업데이트 검사
- `npm run export:web` — 정적 웹 배포 파일을 `dist/`에 생성
- `npm run build:android` — 로컬 Android 릴리스 빌드 (Android SDK/JDK 필요)

Expo Router와 Supabase를 사용하며 홈·집중·기록·친구·연차·프로필 화면을 서버 데이터에 연결한다. 현재 작업본의 기능과 사용 흐름은 [화면별 기능 안내](docs/product/CURRENT-FEATURES.md)에 정리한다. 구현 여부와 실제 배포·실기기 검증 여부는 구분한다.

공통 시작 화면에는 버전 표시와 업데이트 안내가 연결되어 있다. Supabase 배포 정보 테이블은 준비했으며 새 버전 활성화 전에는 안내하지 않는다. APK 설치 및 웹 호스팅 갱신은 아직 실기기로 검증하지 않았다.

인증 오류나 기존 세션 유실 시 자동으로 새 UID를 만들지 않고 재시도를 안내한다. 현재 기능은 [화면별 기능과 사용 흐름](docs/product/CURRENT-FEATURES.md), 날짜·목표·출석·연차 규칙은 [상세 기능 정책](docs/product/FEATURE-POLICIES.md), 복구 구조는 [기술 설계](docs/development/ARCHITECTURE.md)를 참고한다.

실제 DB 통합 검사: `node --env-file=.env.local scripts/check-study-core.mjs --run`. 테스트 사용자 2명과 종료 세션을 생성하므로 필요할 때만 실행한다. 일반 `npm test`는 외부 서비스에 쓰지 않는다.

## 기능 개발 및 PR

- 최신 `develop`을 기준으로 기능별 작업 브랜치를 만든다. Codex가 만드는 브랜치는 `codex/` 접두사를 사용한다.
- 기능 구현은 작업 브랜치에서 진행하고, PR의 대상 브랜치(base)는 `develop`으로 지정한다.
- PR을 올리기 전에 `npm run lint`와 `npm run typecheck`를 실행한다.
- 운영 배포는 [버전 및 업데이트 운영](docs/operations/RELEASES.md)의 `develop` → `master` 배포 PR 절차를 따른다.

## 환경 변수

`.env.example`을 `.env.local`로 복사하고 Supabase 프로젝트의 URL과 publishable key를 입력한다. 시작 화면 실행에는 필요하지 않다. `EXPO_PUBLIC_` 변수는 앱에 공개되므로 service role/secret key를 넣지 않는다. DB 접근 권한은 RLS로 제한한다.

## 배포 방향

Android는 서명된 릴리스 APK를 직접 전달한다. `eas.json`은 선택적인 EAS APK 빌드 프로필이며 EAS CLI와 계정은 별도로 필요하다. 로컬 빌드는 Android 도구가 있는 환경에서 가능하다. 서명 키를 보관해야 같은 앱의 업데이트를 배포할 수 있다.

`build:android`는 로컬 릴리스 검증용이다. 배포용 서명 설정을 대신하지 않는다. APK 전달 전 배포 키로 서명되었는지 확인해야 한다. `com.yumyumstudy.app`은 초기 패키지 ID이므로 첫 배포 전에 확정한다.

iPhone에는 HTTPS 웹 주소를 전달한다. 홈 화면 추가용 manifest·아이콘·메타데이터는 구현 단계에서 연결하고 실기기로 확인한다. 무료 호스팅과 Supabase 무료 한도에서 시작하되 상시 무료 운영은 보장하지 않는다.

## 문서

- [문서 전체 안내](docs/README.md) — 종류별 문서 목록과 참고 시점
- [제품 명세](docs/product/SPEC.md)
- [상세 기능 정책과 검증 기준](docs/product/FEATURE-POLICIES.md)
- [화면별 기능과 사용 흐름](docs/product/CURRENT-FEATURES.md) — 제품 명세의 하위 화면 문서
- [설계 및 구현 순서](docs/development/ARCHITECTURE.md)
- [데이터 및 API 공통 계약](docs/development/CONTRACT.md)
- [버전 및 업데이트 운영](docs/operations/RELEASES.md)
- [Xcode로 iPhone 웹앱 테스트하기](docs/development/IPHONE-WEB-TESTING.md)

## 공식 참고

- [Expo 시작](https://docs.expo.dev/get-started/create-a-project/)
- [Expo 웹앱/PWA](https://docs.expo.dev/guides/progressive-web-apps/)
- [Android APK 빌드](https://docs.expo.dev/build-reference/apk/)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

## 공통 컴포넌트 Storybook

`npm run storybook` 실행 후 http://127.0.0.1:6006 에서 확인합니다.

- **시작하기 → 전체 둘러보기**: 앱의 실제 공통 컴포넌트를 한 화면에서 비교합니다.
- **기본 스타일**: 색상 팔레트와 용도별 글자 크기를 확인합니다.
- **공통 컴포넌트**: 버튼(기본·보조·불투명 크림·원형·아이콘·로딩·비활성), 카드, 누르는 카드, 흰색 전환 탭, 수박 배지를 확인합니다.
- 각 예시의 **Controls**에서 문구·크기·상태를 변경할 수 있습니다. 탭과 카드 클릭은 미리보기 안에서만 동작하며 실제 공부 기록을 저장하지 않습니다.
- 디자인 값은 `src/design/theme.ts`, 공통 컴포넌트는 `src/design/components.tsx`, 예시는 `stories/`에서 관리합니다. 예시는 앱 라우트 밖에 있어 앱 배포 화면에 포함되지 않습니다.
- `npm run build-storybook`으로 `storybook-static/`에 정적 미리보기를 생성합니다. 브라우저 미리보기이며 Android/iPhone 실기기 확인을 대체하지 않습니다.

## 테스트 방과 실제 방

Supabase 프로젝트 하나에서 **0번 방은 개발용**, **1번 방은 실제 사용용**으로 구분한다.
`expo start` 개발 실행은 0번, 배포용 APK와 `npm run export:web` 결과는 1번에 연결된다.
개발 화면에는 `테스트 방 · 0번`을 표시하고 운영 업데이트 안내는 조회하지 않는다.
같은 기기의 개발/배포 실행은 인증 세션과 UID 저장 키를 분리하며, 기존 운영 키와 기록은 유지한다.
개발 실행에서 기존 1번 방의 기록이 보이지 않는 것은 정상이다. 기존 기록을 0번으로 옮기지 않는다.

DB 변경은 `supabase/migrations/240_test_room.sql`, 트랜잭션 롤백 검사는
`supabase/tests/test_room.sql`에 있다. RLS와 친구 조회 RPC는 본인 방만 조회한다.
방 번호는 로그인 시 확정되며 기존 UID를 다른 방으로 이동시키지 않는다.
방 분리는 데이터 구분용이며, 같은 DB의 구조 변경까지 격리하는 별도 서버 환경은 아니다.


## 첫 입장과 이름 설정

250, 251 마이그레이션을 적용했다. 실제 1번 방 신규 사용자는 초대 코드 확인 후
1~12자 이름을 저장해야 공부/친구/목표/연차 화면과 API를 사용할 수 있다. 중복 이름은 허용한다.
기존 프로필은 기록과 입장 자격을 유지하고 이름 설정만 한 번 진행한다.
개발용 0번 방은 초대 코드를 입력하지 않고 ‘테스트로 입장하기’로 같은 이름 설정 흐름을 확인한다.
단계는 서버에 저장하며 이름 설정 전 종료하면 다음 실행 시 이름부터 이어진다.
홈의 ‘이름 변경’에서 나중에 수정할 수 있다.

2026-10-27 실제 1번 방 초대 코드를 Supabase에 등록하고 일치 검증을 완료했다.
`room_invites`에는 원문 대신 `extensions.crypt`로 만든 해시를 저장한다. 실제 코드를 앱 소스나 EXPO_PUBLIC 변수, Git에 넣지 않는다.
코드 변경은 기존 멤버의 입장 자격을 취소하지 않는다.
잘못된 코드는 UID별 15분 동안 최대 5회까지만 검증한다.
별도 계정 생성으로 UID를 바꿀 수 있으므로 이것은 인터넷 전체에 대한 강한 가입 제한은 아니다.
인원 제한 4명과 계정 복구는 이번 변경에 포함하지 않았다.

검사 SQL: `supabase/tests/room_onboarding.sql` (검사용 초대 코드/사용자/기록 모두 rollback).

## S23용 빠른 로컬 테스트 APK

`npm run build:android:test:fast -- --non-interactive`

첫 실행은 기존 EAS 로컬 빌드로 ARM64 테스트 앱을 만들고, 이후에는 생성된 네이티브
프로젝트와 컴파일 결과를 재사용한다. 현재 소스의 수정·삭제를 동기화하며 테스트 앱 ID와
EAS 서명을 유지한다. 결과는 `builds/yumyumstudy-test.apk`에 저장한다.

의존성, 네이티브 모듈, 앱 설정, 로컬 환경 파일이 바뀌면 새 작업 폴더를 자동 생성한다.
Expo 서버의 preview 환경변수나 서명 키를 바꿨다면
`npm run build:android:test:fast -- --non-interactive --refresh`로 갱신한다.
기존 전체 빌드는 `npm run build:android:test:local -- --non-interactive`로 계속 사용할 수 있다.

`builds/local-test-cache/`에는 서명 정보가 포함되어 있으므로 공유하거나 저장소에 넣지 않는다.
Git과 EAS 업로드에서는 `builds/` 전체가 제외된다. 이전 작업 폴더는 자동 삭제하지 않으며,
빌드 중이 아닐 때 이 캐시 폴더를 지우면 다음 실행에서 다시 생성된다.
