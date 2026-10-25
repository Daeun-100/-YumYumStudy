# 얌얌스터디

구현 원칙: **최대한 간단하게.** 현재 MVP에 필요한 기능과 최소 구조를 우선한다. 구체적인 기준은 [설계 문서](docs/ARCHITECTURE.md)에 기록한다.

4명이 공부 목표와 기록을 공유하는 앱. Android는 APK, iPhone은 Safari 웹앱으로 사용한다.

로그인 화면과 방 만들기 없이 고정 방 하나에 자동 참여한다. 뒤에서 자동 익명 인증으로 UID를 발급해 기록을 구분하고 이름은 표시용으로 사용한다. 저장소 삭제·기기 변경 시 UID가 달라질 수 있으며 MVP에서는 이전·복구를 제공하지 않는다.

타이머는 화면 이탈·잠금 후에도 시간을 누적하고 직접 중지하면 종료하는 방식으로 설계한다. 다른 앱 사용 시간도 포함한다. 현재 타이머 기능은 구현 전이다.

## 개발 시작

- Node.js 22 LTS, npm 사용 (`.nvmrc` 참고)
- `npm ci` — 잠금 파일 기준 설치
- `npm run web` — 웹 개발 서버
- `npm run android` — Android 개발 실행 (에뮬레이터 또는 연결된 기기 필요)
- `npm run typecheck` — TypeScript 검사
- `npm run lint` — Expo ESLint 검사
- `npm test` — 업데이트 배포 번호·링크·조회 오류 검사
- `npm run export:web` — 정적 웹 배포 파일을 `dist/`에 생성
- `npm run build:android` — 로컬 Android 릴리스 빌드 (Android SDK/JDK 필요)

현재는 공통 시작 화면과 개발 설정만 구성되어 있다. 자동 UID 발급·고정 방 참여, 타이머, DB 연결, PWA 설치 지원은 아직 구현하지 않았다. Android 네이티브 빌드는 별도 도구 설치와 실기기 검증이 필요하다.

공통 시작 화면에는 버전 표시와 업데이트 안내가 연결되어 있다. Supabase 배포 정보 테이블은 준비했으며 새 버전 활성화 전에는 안내하지 않는다. APK 설치 및 웹 호스팅 갱신은 아직 실기기로 검증하지 않았다.

## 환경 변수

`.env.example`을 `.env.local`로 복사하고 Supabase 프로젝트의 URL과 publishable key를 입력한다. 시작 화면 실행에는 필요하지 않다. `EXPO_PUBLIC_` 변수는 앱에 공개되므로 service role/secret key를 넣지 않는다. DB 접근 권한은 RLS로 제한한다.

## 배포 방향

Android는 서명된 릴리스 APK를 직접 전달한다. `eas.json`은 선택적인 EAS APK 빌드 프로필이며 EAS CLI와 계정은 별도로 필요하다. 로컬 빌드는 Android 도구가 있는 환경에서 가능하다. 서명 키를 보관해야 같은 앱의 업데이트를 배포할 수 있다.

`build:android`는 로컬 릴리스 검증용이다. 배포용 서명 설정을 대신하지 않는다. APK 전달 전 배포 키로 서명되었는지 확인해야 한다. `com.yumyumstudy.app`은 초기 패키지 ID이므로 첫 배포 전에 확정한다.

iPhone에는 HTTPS 웹 주소를 전달한다. 홈 화면 추가용 manifest·아이콘·메타데이터는 구현 단계에서 연결하고 실기기로 확인한다. 무료 호스팅과 Supabase 무료 한도에서 시작하되 상시 무료 운영은 보장하지 않는다.

## 문서

- [제품 명세](docs/SPEC.md)
- [설계 및 구현 순서](docs/ARCHITECTURE.md)
- [결정이 필요한 항목](docs/DECISIONS.md)
- [여러 Codex 세션용 실행 문서](docs/execution/README.md)
- [버전 및 업데이트 운영](docs/RELEASES.md)

## 공식 참고

- [Expo 시작](https://docs.expo.dev/get-started/create-a-project/)
- [Expo 웹앱/PWA](https://docs.expo.dev/guides/progressive-web-apps/)
- [Android APK 빌드](https://docs.expo.dev/build-reference/apk/)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
