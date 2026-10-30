# 관리자 운영 도구 안내

꾸미기 이미지, 이벤트·보상, 알림을 아래 기준으로 선택한다. 이미지 등록은 실제 지급이나 행사 예약을 실행하지 않는다.

| 목적 | 도구 | 담당 명령·절차 |
| --- | --- | --- |
| 배경·스킨·포스트잇 PNG 관리 | `supabase/scripts/manage-artwork.mjs` | `prepare`, `upload`, `register`, `verify`, `list` |
| 스킨 개별 지급·착용 | `supabase/scripts/manage-skins.mjs` | `members`, `catalog`, `grant`, `apply`, `reset`, `enable`, `disable` |
| 스킨 일괄 지급·방 배경 기간 예약 | `supabase/scripts/manage-events.mjs` | `schedule`, `list`, `status`, `cancel`, `recover`, `background` |
| 공부 조건 포스트잇 보상 | `supabase/scripts/manage-postit-designs.mjs` | `reward`, `report`, `cancel`, `enable`, `disable` |
| OS 푸시 | `scripts/admin-notifications.mjs` | `--preview`, `--send`, `--status` |
| 앱 내부 안내·OTA 업데이트 안내 | `scripts/admin-toasts.mjs` | `preview`, `create`, `list`, `status`, `delete` |

## 꾸미기 이미지

배경·스킨은 홈/집중 PNG 두 장, 포스트잇은 종이 PNG와 선택 미리보기를 공통 도구로 등록한다. 세 종류의 목록은 같은 이미지 라이브러리에서 조회한다. 규격과 업로드 절차는 [이미지 운영](ARTWORK-OPERATIONS.md)을 따른다.

기존 `manage-postit-designs.mjs prepare/upload/register/list`는 공통 도구로 전달하는 호환 명령이다. 신규 운영 절차에는 `manage-artwork.mjs`를 사용한다. 종이의 기존 표현을 보존하기 위해 포스트잇 파일 덮어쓰기는 지원하지 않는다.

원격 스킨은 공통 이미지 등록 시 스킨 정보도 함께 등록한다. `manage-skins.mjs register`는 앱 내장 스킨 메타데이터 등록용으로 유지한다. 등록 시 `--activate`는 지급·예약 가능 상태를 켤 뿐 사용자에게 지급하지 않는다.

## 이벤트·보상

[이벤트 예약](EVENT-OPERATIONS.md)은 시각에 따른 스킨 일괄 지급과 방 배경 적용·종료를 관리한다. [포스트잇 보상](POSTIT-DESIGNS.md)은 정해진 기간의 실제 공부 시간 조건을 판정한다. 실행 기준과 처리 이력이 다르므로 보상 규칙을 배경 예약으로 대신하지 않는다. 개인 스킨 지급·착용은 [스킨 운영](CHARACTER-SKINS-OPERATIONS.md)을 따른다.

## 알림

푸시는 앱 밖 OS 알림이고 토스트는 앱 내부 표시다. 자격 증명과 서버 처리가 각각 있으므로 한 도구의 성공을 다른 수신 경로의 성공으로 해석하지 않는다. [서버 운영](SERVER-OPERATIONS.md)과 [관리자 토스트](ADMIN-TOASTS.md)를 따른다. 이벤트 스킨 지급에 연결한 푸시는 이벤트 작업의 결과로 확인하며 같은 공지를 수동으로 중복 발송하지 않는다.

## 그 밖의 운영

배포·버전 관리는 [릴리스 운영](RELEASES.md), DB·장애·로그 확인은 [서버 운영](SERVER-OPERATIONS.md), 관리자 연차는 [연차 운영](ADMIN-LEAVE.md)을 따른다. `check-*.mjs`는 검증용이며 이미지 등록·보상 지급 도구가 아니다.
