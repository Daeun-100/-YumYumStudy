# 다운로드 페이지

HTML과 CSS만 사용하는 앱과 별개의 설치 안내 페이지입니다.

- 공개 주소: https://daeun-100.github.io/-YumYumStudy/
- Android: GitHub Release의 APK 고정 주소로 다운로드합니다.
- iPhone: Safari에서 기존 Expo 웹 앱을 열어 홈 화면에 추가하도록 안내합니다.

`master`의 이 폴더가 변경되면 `Download Site` 액션이 GitHub Pages로 배포합니다. 저장소 Settings → Pages의 Source는 GitHub Actions입니다. 앱 버전이 올라가면 `index.html`의 APK 링크도 새 공개 Release 파일로 변경합니다. 초대 코드와 비밀키는 넣지 않습니다.

로컬 확인: `python3 -m http.server 8090 --directory download-site`
