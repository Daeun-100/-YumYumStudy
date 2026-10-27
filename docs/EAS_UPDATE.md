# 얌얌스터디 EAS Update 배포 방법

EAS Update는 새 APK를 설치하지 않고 JavaScript와 이미지 등의 변경을 전달하는 OTA 업데이트다. 이 문서는 현재 프로젝트의 Android 배포 설정을 기준으로 한다.

## 1. OTA로 배포할 수 있는 변경인지 확인

| 변경 내용 | 배포 방식 |
| --- | --- |
| 화면, 문구, 스타일, JavaScript 로직, 일반 이미지 | 호환되는 런타임에 EAS Update |
| 네이티브 라이브러리 추가·업데이트, Expo SDK 변경, Android 권한, config plugin, 네이티브 모듈 변경 | 새 APK 빌드·설치 |
| 앱 아이콘, 스플래시 등 네이티브 설정 변경 | 새 APK 빌드·설치 |
| Supabase DB 또는 Edge Function 변경 | 별도 서버 배포; 앱 변경이 있으면 앱도 별도 배포 |

`fingerprint` 정책이 네이티브 구성에서 런타임 버전을 계산한다. 설치된 APK와 업데이트의 런타임이 같아야 적용된다. 런타임이 달라졌다면 새 APK가 필요하다.

## 2. 채널과 환경 구분

| 대상 | 앱 패키지 | EAS Build 프로필 | 업데이트 채널 | EAS 환경 |
| --- | --- | --- | --- | --- |
| 테스트 | `com.yumyumstudy.app.test` | `test` 또는 `preview` | `test` | `preview` |
| 운영 | `com.yumyumstudy.app` | `production` | `production` | `production` |

`preview` 빌드 프로필은 `test`를 상속한다. Git 브랜치와 EAS 채널은 별개다. `develop`에서 명령을 실행해도 운영 업데이트 명령을 쓰면 운영 채널로 배포된다.

설정 위치:

- `app.config.js`: 업데이트 URL, variant별 채널, fingerprint 런타임
- `eas.json`: APK 빌드 프로필과 채널·환경
- `package.json`: 테스트·운영 업데이트 명령

## 3. 최초 1회: OTA 지원 APK 설치

OTA 설정이 없던 기존 APK는 이 설정을 원격으로 받을 수 없다. EAS Update 설정을 포함한 새 APK를 한 번 설치해야 한다.

프로젝트 루트에서 로그인 상태를 확인한다.

```sh
npx eas-cli@latest whoami
```

로그인되지 않았다면:

```sh
npx eas-cli@latest login
```

클라우드에서 테스트 APK를 만든다. 빌드 설정에 `requireCommit: true`가 있으므로 빌드할 변경을 먼저 커밋한다.

```sh
npx eas-cli@latest build --platform android --profile test
```

빌드 완료 화면의 링크에서 APK를 내려받아 테스트 기기에 설치한다. 운영 앱에도 OTA를 도입하려면 운영 APK를 별도로 빌드하고 배포한다.

```sh
npx eas-cli@latest build --platform android --profile production
```

이후 호환되는 JS·이미지 변경은 아래 업데이트 명령으로 배포할 수 있다. 클라우드 APK 빌드의 자세한 절차는 [CLOUD-BUILDS.md](./CLOUD-BUILDS.md)를 참고한다.

## 4. 배포 전 검사

프로젝트 루트에서 실행한다.

```sh
git branch --show-current
git status --short
npx expo lint
npx tsc --noEmit
```

두 검사가 통과한 뒤 배포한다. EAS Update는 현재 작업 폴더의 코드를 번들링하므로 미커밋 변경도 포함될 수 있다. 배포할 변경을 커밋하고 커밋 ID를 기록해 두는 것을 권장한다.

빌드와 업데이트에 사용하는 EAS 환경의 공개 변수가 일치하는지 확인한다.

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- 앱 구분 값은 테스트 `test`, 운영 `production`

업데이트 스크립트는 `APP_VARIANT`와 `EXPO_PUBLIC_APP_VARIANT`를 명시하고 `--environment`를 지정한다. EAS 환경에 같은 변수가 있다면 대상 variant와 일치하도록 설정한다. `eas.json`의 빌드 전용 `env` 값이 업데이트에도 자동으로 적용된다고 가정하지 않는다.

EAS 환경변수는 Expo 프로젝트 대시보드에서 확인한다. `EXPO_PUBLIC_*`는 앱 번들에 포함되는 공개 값이므로 비밀키를 넣지 않는다. 로컬 `.env`만 수정한 것으로 원격 EAS 환경까지 바뀌지는 않는다.

## 5. 테스트 채널에 배포

```sh
npm run update:test -- --message "공부 기록 화면 표시 오류 수정"
```

이 명령은 다음 값으로 Android 업데이트를 배포한다.

- 채널: `test`
- EAS 환경: `preview`
- 앱 variant: `test`

완료 출력의 업데이트 링크, 업데이트 그룹 ID, 런타임 버전과 배포한 Git 커밋을 기록한다. 명령이 실패했다면 성공한 것으로 간주하지 말고 출력의 원인을 해결한다.

## 6. 기기에서 적용 확인

1. OTA 설정을 포함한 **테스트 APK**가 설치되어 있는지 확인한다. Expo Go 대신 설치한 APK로 검증한다.
2. 인터넷에 연결한 상태에서 앱을 실행하고 업데이트가 다운로드될 시간을 준다.
3. 앱을 완전히 종료한 뒤 다시 실행한다. 필요하면 종료·실행을 한 번 더 한다.
4. 변경한 화면을 확인하고 공부 시작·종료, 기록, 로그인 등 영향받는 기능을 확인한다.

기본 동작은 앱 시작 시 백그라운드로 다운로드하고 다음 재시작 때 적용하는 방식이다. 배포 직후 실행 중인 모든 앱 화면이 즉시 바뀌지는 않는다. 현재 앱에는 공부 도중 강제로 재시작시키는 별도 업데이트 로직이 없다.

## 7. 검증한 코드를 운영 채널에 배포

테스트가 통과한 코드 상태를 유지한 채 실행한다. 테스트 이후 코드가 바뀌었다면 다시 테스트한다.

```sh
npm run update:production -- --message "공부 기록 화면 표시 오류 수정"
```

운영 명령은 `production` 채널·환경·variant로 별도 번들을 생성한다. 테스트 채널의 번들을 그대로 운영으로 옮기는 방식이 아니다. 운영 APK에서도 종료·재실행 후 변경 사항과 주요 기능을 확인한다.

OTA 배포만으로 다운로드 페이지의 APK 파일이 교체되지는 않는다. 새 APK가 필요한 변경이라면 기존 APK 배포 절차도 수행한다.

## 8. 적용되지 않을 때

| 증상 또는 원인 | 확인할 내용 |
| --- | --- |
| 기존 APK에 변화 없음 | OTA 도입 전 APK라면 새 APK 설치 |
| 테스트 배포가 운영 앱에 안 보임 | 정상적인 채널 분리다. 설치 앱과 배포 채널 확인 |
| 업데이트는 성공했지만 적용 안 됨 | APK와 업데이트의 런타임 버전 비교. 다르면 새 APK 필요 |
| 첫 실행에는 이전 화면이 보임 | 다운로드를 기다린 후 완전히 종료하고 재실행 |
| Supabase 연결 오류 또는 variant 오류 | EAS `preview`/`production` 공개 환경변수와 앱 구분 확인 |
| 로그인·프로젝트 권한 오류 | `npx eas-cli@latest whoami`와 프로젝트 접근 권한 확인 |

프로젝트 대시보드에서 빌드와 업데이트 정보를 확인한다: [얌얌스터디 Expo 프로젝트](https://expo.dev/accounts/daeun-100s-team/projects/yumyumstudy).

## 9. 문제가 있는 업데이트 되돌리기

EAS의 대화형 롤백 명령을 실행한다.

```sh
npx eas-cli@latest update:rollback
```

안내에 따라 대상 브랜치·런타임을 확인하고 이전 정상 업데이트 또는 APK에 포함된 기본 업데이트로 되돌린다. 운영 장애라면 운영 채널이 연결된 브랜치를 선택했는지 확인한다. 롤백 후 기기에서 다운로드·재실행해 복구를 검증한다. 롤백도 네트워크와 앱의 업데이트 확인이 필요하므로 모든 기기에 즉시 반영되는 것은 아니다.

## 공식 문서

- [EAS Update 시작하기](https://docs.expo.dev/eas-update/getting-started/)
- [런타임과 네이티브 호환성](https://docs.expo.dev/eas-update/runtime-versions/)
- [EAS 환경변수](https://docs.expo.dev/eas/environment-variables/)
- [업데이트 롤백](https://docs.expo.dev/eas-update/rollbacks/)
