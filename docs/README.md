# 문서 안내

문서는 용도별로 관리한다. 작업 규칙과 실행 명령은 저장소 루트의 [AGENTS.md](../AGENTS.md)와 [README.md](../README.md)를 먼저 확인한다.

| 폴더 | 용도 | 참고할 때 |
| --- | --- | --- |
| `product/` | 제품 방향, 현재 정책, 화면 사용 흐름과 기능 명세 | 기능을 기획하거나 기대 동작을 판단할 때 |
| `development/` | 기술 설계, 데이터·API 계약과 개발 테스트 | 코드를 수정하거나 플랫폼 동작을 검증할 때 |
| `operations/` | 배포, 버전 관리와 관리자 운영 절차 | APK·웹·OTA를 배포하거나 연차·스킨을 관리할 때 |
| `proposals/` | 기획·개선 설계와 관련 시안 | 문서의 구현 상태를 확인하며 후속 기능과 개선을 검토할 때 |

## 제품과 정책

- [제품 명세](product/SPEC.md): 제품 목적, 핵심 가치와 기능 범위
- [상세 기능 정책과 검증 기준](product/FEATURE-POLICIES.md): 입력 제한, 날짜·상태 판정, 예외와 권한
- [화면별 기능과 사용 흐름](product/CURRENT-FEATURES.md): 현재 작업본의 화면 진입·표시·조작
- [캐릭터 이벤트 스킨 명세](product/CHARACTER-SKINS-SPEC.md): 스킨 보유·선택·표시와 호환성

## 개발과 테스트

- [기술 설계와 구현 원칙](development/ARCHITECTURE.md)
- [데이터 및 API 공통 계약](development/CONTRACT.md)
- [iPhone 웹앱 테스트](development/IPHONE-WEB-TESTING.md)
- 이미지 파일을 추가하거나 교체할 때는 [에셋 규칙](../assets/README.md)을 따른다.

## 배포와 운영

- [버전 및 배포 운영](operations/RELEASES.md): 배포 절차와 현재 버전관리 규칙
- [클라우드 빌드](operations/CLOUD-BUILDS.md)
- [EAS Update](operations/EAS_UPDATE.md)
- [사용자별 마지막 확인 버전](operations/APP-VERSION-REPORTING.md): 설치 버전·실행 코드 관측과 관리자 조회
- [서버 운영과 장애 확인](operations/SERVER-OPERATIONS.md): DB 적용, 친구 부르기 알림, Discord 로그 감시
- [관리자 연차](operations/ADMIN-LEAVE.md)
- [캐릭터 이벤트 스킨 운영](operations/CHARACTER-SKINS-OPERATIONS.md)
- 설치 안내 사이트는 [다운로드 페이지 안내](../download-site/README.md)를 참고한다.

## 기획과 개선안

- [목표 달성 보상 명세](proposals/GOAL-ACHIEVEMENT-REWARDS-SPEC.md): 7일 완주 금색 수박, 기존 인포 팝업 안내와 수집·소비 제외

- [공부방 데이터 갱신 개선안](proposals/STUDY-REFRESH-DESIGN.md)
- [수박 보상과 꾸미기 시안](proposals/WATERMELON-REWARDS-DRAFT.md)

현재 정책은 제품 명세와 상세 기능 정책을 기준으로 확인한다. 기획·개선안은 문서에 적힌 구현 상태와 실제 코드를 확인한다. 시안 이미지는 해당 제안의 `assets/`에 보관한다. 서버 반영 기록이나 로컬 검사를 현재 배포·실기기 검증 완료로 해석하지 않는다. 문서를 이동할 때는 연결된 상대 링크와 저장소 내 경로 참조를 함께 갱신한다.
