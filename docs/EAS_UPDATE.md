# EAS Update

Android OTA 설정은 `app.config.js`와 `eas.json`에서 관리한다.

- 테스트 앱: `test` 채널, EAS `preview` 환경
- 운영 앱: `production` 채널, EAS `production` 환경
- `preview` 빌드 프로필은 `test`를 상속한다.
- `fingerprint` 런타임 정책으로 네이티브 코드와 호환되는 업데이트만 받는다.

## 최초 적용

기존 OTA 미설정 APK는 업데이트를 받을 수 없다. 이 설정을 포함한 APK를 한 번 빌드하고 설치해야 한다. 네이티브 모듈이나 네이티브 설정이 바뀌어 런타임이 변경될 때도 새 APK가 필요하다.

빌드와 업데이트는 같은 EAS 환경의 공개 환경변수를 사용해야 한다. `preview`/`production` 환경에 필요한 Supabase 공개 변수가 설정되어 있는지 확인한다. 배포 명령은 각 앱 variant를 명시한다.

## 업데이트 배포

```sh
npm run update:test -- --message "변경 내용"
npm run update:production -- --message "변경 내용"
```

스크립트는 Android만 배포한다. EAS 로그인이 필요하다. 테스트 채널에서 확인한 뒤 운영 채널에 배포한다.

기본 동작은 앱 시작 시 백그라운드 다운로드 후 다음 재시작에 적용하는 방식이다. 확인할 때는 네트워크가 연결된 상태에서 앱을 열고 다운로드를 기다린 뒤 완전히 종료하고 다시 연다. 공부 도중 강제로 재시작하지 않는다.

공식 문서: https://docs.expo.dev/eas-update/getting-started/
