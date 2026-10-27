# 프로필 캐릭터 — 2026-10-27

- 신규 입장 시 이름과 캐릭터를 set_profile 한 번으로 저장한다. 마이페이지(/profile)에서 이름과 캐릭터를 수정한다.
- 캐릭터: bunny, bear, cat, puppy, maltese, pomeranian. 기존 프로필 기본값 bunny. 클라이언트는 이전 서버 응답에서 character가 빠진 경우에도 bunny를 표시한다.
- 260_profile_character.sql을 원격 SQL Editor로 적용 완료. CLI 마이그레이션 이력에는 별도 등록하지 않았으므로 중복 실행 금지.
- get_onboarding / ensure_profile / get_today / get_room 응답에 캐릭터 포함. 본인만 변경할 수 있고 입장 확인 전에는 변경할 수 없다.
- 홈의 본인 캐릭터, 공부 중 친구 아이콘, 친구 목록에 저장한 캐릭터를 표시한다. 집중 화면의 기존 단일 배경 일러스트는 개별 캐릭터를 표시하지 않는다.
- SQL 롤백 검사 통과: 6종 저장과 프로필/오늘/방 조회, 잘못된 이름·캐릭터 거부. 재현 파일: supabase/tests/profile_character.sql.
- 브라우저 0번 방: 홈테스트 캐릭터를 고양이로 변경, 새로고침 후 유지 및 홈 반영 확인. localhost의 별도 테스트 UID로 캐릭터테스트/곰 신규 입장 확인. 운영 방 사용자 데이터는 편집하지 않았다.
- lint, tsc --noEmit, 자동 테스트 50개 통과. 실기기 미검증.
- 화면 증거: docs/images/profile-character-verified.png.

## 검은 고양이 저장 오류 수정 — 2026-10-27

- 연결된 서버의 profiles_character_check가 기존 6종만 허용하여 blackcat 저장을 거절하는 것을 확인했다.
- 280_blackcat_character.sql을 연결된 서버에 적용하여 제약조건과 set_profile에 blackcat을 추가했다. CLI 마이그레이션 이력에는 별도 등록하지 않았으므로 재배포 전에 이력을 정합화해야 한다.
- supabase/tests/profile_character.sql 원격 검사 통과: 7종 저장, 프로필/오늘/방 재조회, 잘못된 입력 거부. 테스트 변경은 모두 롤백했다.
- npm run lint, npm run typecheck 통과. 앱 코드 변경이나 재설치는 필요하지 않다. 실기기 화면 조작은 미검증.
