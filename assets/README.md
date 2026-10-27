# 에셋 이름 규칙

모든 에셋은 영문 소문자와 숫자, 하이픈(`-`)만 사용한다. 파일명은 `대상-용도[-변형].확장자` 순서로 작성하며 공백, 밑줄, 날짜, `final`, `new`, `simple` 같은 작업 상태를 넣지 않는다. 확장자도 소문자로 쓴다.

## 폴더와 이름

| 폴더 | 규칙 | 예시 |
| --- | --- | --- |
| `app/` | 앱·플랫폼 아이콘: `대상-icon[-레이어]`, 웹 파비콘: `web-favicon` | `app-icon.png`, `splash-icon.png`, `android-icon-foreground.png`, `web-favicon.png` |
| `backgrounds/` | `화면-background` | `home-background.png`, `focus-background.png` |
| `characters/<캐릭터>/` | `캐릭터-상태` | `bunny-home.png`, `bunny-focus.png`, `bunny-leave.png` |
| `icons/` | `대상-icon` | `watermelon-icon.png` |
| `illustrations/` | `대상-illustration` | `study-room-illustration.png` |

캐릭터 ID는 `bunny`, `bear`, `cat`, `puppy`, `maltese`, `pomeranian`이다. 각 캐릭터는 `home`(홈·프로필), `focus`(집중·친구), `leave`(연차) 세 상태를 같은 규칙으로 제공한다. DB의 캐릭터 ID는 파일명 변경과 무관하게 유지한다.

## 변형과 원본

앱에서 사용하는 기본 에셋에는 변형 접미사를 붙이지 않는다. 보관하는 시안·원본에는 `-variant-설명`을 붙인다. 예: `home-background-variant-original.png`, `home-background-variant-expanded-cozy.png`.

실제로 구분이 필요한 시각적 변형만 설명에 적는다. 원본/시안을 삭제하거나 다른 파일 위에 덮어쓰지 않는다. 이미지 내용과 확장자는 이름 통일 과정에서 변경하지 않는다.

## 파일 변경 시

파일 이름이나 위치를 바꾸면 앱, Storybook, Expo 설정(`app.json`), 문서의 참조도 함께 수정한다. React Native가 번들에 포함할 수 있도록 이미지 경로는 정적인 import 또는 require로 작성한다. 생성 결과물(`dist/`, `storybook-static/`)은 직접 수정하지 않고 다시 빌드한다.

변경 뒤에는 lint, 타입 검사와 영향을 받는 앱/Storybook 빌드를 확인한다.
