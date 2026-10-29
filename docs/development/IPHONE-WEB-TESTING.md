# Xcode로 iPhone 웹앱 테스트하기

얌얌스터디의 iPhone 배포 대상은 Safari 웹앱이다. Xcode로 iPhone 시뮬레이터를 준비한 뒤 **시뮬레이터 안의 Safari에서 웹 주소를 열어** 테스트한다. 포스트잇 입력 중 키보드가 열릴 때 작성창이 유지되는지 확인하는 데 사용한다.

Expo Go나 iOS 네이티브 앱 실행은 별도 경로다. 이번 웹 문제를 확인할 때는 iOS 앱 빌드, 서명, 유료 Apple Developer 가입이 필요하지 않다.

## 평소에는 한 명령으로 실행

Xcode와 iOS 런타임을 처음 한 번 설치한 뒤 저장소 루트에서 실행한다.

```bash
npm run web:iphone
```

이 명령은 설치된 Xcode를 찾아 사용하고, 실행 중인 iPhone을 재사용하거나 사용 가능한 iPhone을 부팅한다. Expo 웹 서버가 준비되면 시뮬레이터 Safari에서 `http://localhost:8081`을 연다. 전역 Xcode 선택 설정은 변경하지 않는다.

기본은 테스트 변형이다. 테스트용 0번 방을 선택한다. 코드 저장 시 Fast Refresh로 반영하므로 매번 빌드하거나 서버를 다시 시작할 필요가 없다. 종료는 실행한 터미널에서 `Ctrl+C`를 누른다. 시뮬레이터는 다음 실행에서 재사용한다.

포트가 사용 중이거나 특정 iPhone을 선택하려면 다음처럼 실행한다.

```bash
npm run web:iphone -- --port 8093
npm run web:iphone -- --device "iPhone 17 Pro"
npm run web:iphone -- --help
```

같은 이름의 기기가 여러 개면 `--device`에 UDID를 지정한다. 기존 포트의 서버를 임의로 재사용하지 않으므로 다른 프로젝트가 열리는 것을 방지한다. 다른 위치에 Xcode를 설치했다면 `DEVELOPER_DIR`로 지정한다.

웹 화면·키보드 동작 검증에는 이 명령을 사용한다. `npm run ios`와 `expo run:ios`는 네이티브 실행 경로이므로 iPhone 웹 테스트에 필요하지 않다.

## 처음 한 번 설정

1. Mac App Store에서 Apple의 Xcode를 설치한다. 현재 macOS에서 최신 버전을 설치할 수 없으면 App Store가 제안하는 호환 버전을 사용한다.
2. Xcode를 한 번 실행한다. 라이선스 내용을 확인하고 동의한 뒤 필요한 초기 구성 요소를 설치한다. Apple 계정 로그인이나 관리자 인증이 뜨면 직접 완료한다.
3. **Xcode → Settings → Components → iOS**에서 시뮬레이터 런타임을 설치한다. Xcode 버전에 따라 메뉴가 Platforms로 표시될 수 있다.
4. **Xcode → Settings → Locations → Command Line Tools**에서 설치한 Xcode를 선택한다.
5. 시뮬레이터를 실행한다. Xcode 26에서는 **Xcode → Open Developer Tool → Simulator**, Xcode 27에서는 Device Hub를 사용한다.
6. iPhone 기기를 선택해 부팅한다. 기기가 없으면 **Window → Devices and Simulators**의 Simulators 탭에서 설치한 iOS 런타임으로 iPhone을 추가한다. Device Hub 버전에서는 해당 앱의 기기 생성 메뉴를 사용한다.

터미널에서 준비 상태를 확인한다.

```bash
xcode-select -p
xcrun simctl list runtimes
xcrun simctl list devices available
```

`xcode-select -p`가 `/Library/Developer/CommandLineTools`만 가리키면 전체 Xcode가 선택되지 않은 상태다. Locations에서 다시 선택한다. 전역 설정을 바꾸지 않고 현재 터미널에서만 지정하려면 다음처럼 실행한다. Xcode를 다른 위치에 설치했다면 경로를 바꾼다.

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcrun simctl list devices available
```

## 로컬 웹앱 실행

저장소 루트에서 실행한다. 이 프로젝트는 npm을 사용한다.

```bash
npm ci
npm run web -- --localhost --port 8081
```

이미 의존성을 설치했다면 `npm ci`는 생략한다. 필요한 공개 환경 변수는 `.env.example`과 README의 환경 변수 항목을 따른다. 비밀 키를 웹 환경 변수에 넣지 않는다.

시뮬레이터 안의 Safari에서 `http://localhost:8081`을 연다. 포트가 사용 중이면 서버 실행 시 다른 포트를 지정하고 Safari 주소에도 같은 포트를 쓴다. Mac의 시뮬레이터는 Mac의 로컬 서버에 접근할 수 있다.

CLI로 열려면 `simctl list devices available`에 표시된 대상 기기의 UDID를 사용한다.

```bash
# 아래 YOUR_SIMULATOR_UDID를 목록의 실제 UDID로 바꾼다.
xcrun simctl boot YOUR_SIMULATOR_UDID
xcrun simctl bootstatus YOUR_SIMULATOR_UDID -b
xcrun simctl openurl YOUR_SIMULATOR_UDID http://localhost:8081
```

이미 부팅된 기기에서는 `boot`를 생략한다. 기기 창이 보이지 않으면 Simulator 또는 Device Hub를 연다.

앱에서 테스트 방 선택 기능이 필요하면 프로젝트의 테스트 변형으로 실행한다.

```bash
APP_VARIANT=test EXPO_PUBLIC_APP_VARIANT=test npm run web -- --localhost --port 8081
```

테스트용 0번 방에서 검증한다. 웹앱을 localhost로 실행해도 설정된 백엔드에는 실제 요청이 전달된다. 실제 방의 사용자나 공부 기록을 테스트 데이터로 사용하지 않는다.

## 소프트웨어 키보드 표시

Mac 키보드로 글자가 입력된다는 사실만으로는 iPhone 키보드 검증이 되지 않는다. **화면 아래에 iOS 키보드가 실제로 나타나는지** 확인한다.

Simulator의 **I/O → Keyboard → Connect Hardware Keyboard**를 끄고 내용 입력칸을 누른다. 필요하면 같은 메뉴의 **Toggle Software Keyboard**를 사용한다. 메뉴 이름과 위치가 다른 버전에서는 기기 창의 키보드 메뉴에서 소프트웨어 키보드 표시를 선택한다.

## 포스트잇 검증 순서

관련 이슈: [#12 iPhone 웹에서 포스트잇 입력칸 선택 시 작성창이 사라지는 문제](https://github.com/Daeun-100/-YumYumStudy/issues/12)

1. 공부방에서 **붙이기**를 누른다.
2. **포스트잇 내용** 입력칸을 누른다.
3. iOS 키보드가 열려도 작성창이 남아 있고 커서가 유지되는지 확인한다.
4. `키보드 열기 닫기 확인`을 입력한다. 한글 조합과 줄바꿈도 확인한다.
5. 키보드를 닫았다 다시 열어도 입력 내용과 선택한 색상이 유지되는지 확인한다.
6. **붙일 위치 고르기**를 누르고 공부방의 위치를 선택한다. 포스트잇이 표시되는지 확인한다.
7. 표시된 포스트잇을 열어 내용이 일치하는지 확인한다. 저장까지 검증했다면 새로고침 후에도 표시되는지 확인한다.

작은 iPhone과 큰 iPhone 화면에서 각각 수행한다. 작성창이 유지되더라도 키보드가 입력칸이나 완료 버튼을 가려 조작할 수 없다면 별도의 레이아웃 문제로 기록한다.

## 문제를 조사할 때

Mac Safari에서 개발자 기능을 활성화한 다음 **Develop → 시뮬레이터 기기 → 열린 웹페이지**를 선택하면 Web Inspector로 콘솔과 DOM을 확인할 수 있다. Safari 버전에 따라 **Settings → Advanced → Show features for web developers** 또는 Develop 메뉴 표시 옵션을 사용한다.

키보드 문제는 입력 전후의 `window.visualViewport.height`, `window.innerHeight`, 입력 요소의 포커스, 작성창 DOM이 제거되는지를 함께 확인한다. 개발자 도구에서 다음은 읽기 전용으로 상태를 확인하는 예다.

```js
({
  visibleHeight: window.visualViewport?.height,
  windowHeight: window.innerHeight,
  focusedElement: document.activeElement?.tagName,
  draft: document.querySelector('textarea[aria-label="포스트잇 내용"]')?.value,
})
```

이번 수정은 공통 `useMeasuredLayout`에서 화면 크기·레이아웃 변형 변경 후 재측정할 때 같은 슬롯의 마지막 유효 크기를 유지한다. 새 측정값을 받으면 갱신하고, 다른 슬롯의 크기는 재사용하지 않는다. 공부방은 재측정 중에도 포스트잇 컴포넌트를 유지하므로 작성 상태가 초기화되지 않아야 한다.

Storybook의 기존 공유 포스트잇 시안은 초기 크기 fallback과 embedded 작성창을 사용한다. 따라서 시안에서 성공한 것만으로 실제 앱의 키보드 문제를 통과 처리하지 않는다. 실제 FocusView와 Modal을 사용하고 초기 크기 fallback이 없는 조건으로 확인한다.

## 자주 막히는 부분

| 증상 | 확인할 내용 |
| --- | --- |
| `unable to find utility simctl` | 전체 Xcode 설치 및 Command Line Tools 선택 여부 |
| 선택할 iPhone이 없음 | iOS 런타임 설치 및 기기 생성 여부 |
| 키보드가 화면에 안 나타남 | Connect Hardware Keyboard 해제 및 소프트웨어 키보드 표시 |
| Safari에서 로컬 주소가 안 열림 | Mac의 개발 서버 실행 여부와 포트 일치 여부 |
| 수정한 코드가 반영되지 않음 | 로컬 개발 주소인지 확인하고 새로고침. 필요하면 서버를 `npm run web -- --localhost --port 8081 --clear`로 재시작 |
| 입력칸을 누르면 작성창이 사라짐 | 화면 크기 변경 시 조건부 렌더링으로 하위 컴포넌트가 제거되는지 확인 |
| 붙일 위치를 누른 뒤 계속 대기 | 콘솔과 저장 요청 확인. ID 생성 오류는 입력창 사라짐과 별개의 문제 |

## 실제 iPhone에서 마지막 확인

시뮬레이터 검증 후 테스트용 HTTPS 배포 주소를 실제 iPhone Safari에서 연다. Safari 탭과 홈 화면에 추가한 웹앱에서 키보드 열기·닫기, 한글 입력, 작성·저장을 확인한다. 화면 회전은 이번 검증 범위에서 제외한다. 실제 iPhone의 `localhost`는 Mac을 가리키지 않으므로 Mac 로컬 주소 대신 접근 가능한 테스트 URL을 사용한다.

검증 결과에는 코드 커밋 또는 작업 상태, 웹 주소, Xcode 버전, iOS 런타임, 기기 모델, 소프트웨어 키보드 표시 여부, 입력창·입력 내용 유지 결과, 저장 결과를 기록한다. 브라우저 크기 변경 테스트와 실제 iOS 키보드 테스트는 구분한다.

## 포스트잇 수정 확인 결과

2026년 10월 27일, Xcode 26.6과 iOS 26.5의 iPhone 17 Pro Safari에서 확인했다. 실제 `FocusView`와 `PostitBoard`, 기본 Modal을 사용하는 로컬 비교 화면이며 서버 저장은 연결하지 않았다.

| 조건 | 결과 |
| --- | --- |
| 수정 전 입력칸 선택 | 작성창이 사라지는 증상 재현 |
| 수정 후 입력칸 선택 | 소프트웨어 키보드가 열려도 작성창 유지 |
| iOS 화면 키보드로 한글 조합 | `ㅎ` → `하` → `한` 입력 가능 |
| 키보드 닫기와 다시 열기 | 작성창과 입력한 `한` 유지 |

## 공식 참고

- [Apple Xcode와 시뮬레이터 설치](https://developer.apple.com/documentation/safari-developer-tools/installing-xcode-and-simulators)
- [Apple Xcode 구성 요소와 런타임 설치](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components)
- [Expo iOS Simulator 설정](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo 웹 개발](https://docs.expo.dev/workflow/web/)

작성 기준: 2026년 10월 27일, 프로젝트 Expo SDK 58. Xcode·Safari 버전에 따라 메뉴 명칭이 다를 수 있다.
