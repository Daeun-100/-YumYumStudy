# 테스트 방 분리 — 2026-10-26

- Supabase `hxwwhgxxvyzqqnxlgqde`에 240 마이그레이션 적용 완료.
- 방: 0 `얌얌스터디 테스트`, 1 `얌얌스터디`. 기존 사용자·기록은 이동하거나 삭제하지 않음.
- 개발 실행은 0, 배포용 웹 export/APK는 1. 인증 저장 키와 기억한 UID를 분리.
- 기존 운영 클라이언트의 인자 없는 ensure_profile() 호환 유지.
- RLS와 get_room()은 현재 UID의 방으로 조회를 제한. 세션 생성은 현재 방을 저장.
- 실제 Supabase에서 트랜잭션 롤백 통합 검사 통과: 양방향 RLS, 친구 조회 RPC,
  테스트 세션 저장, 다른 사용자 중지 거부, 방 이동 거부, 목표/연차 조회, 기존 RPC 호환.
  검사 사용자와 세션은 rollback되어 남지 않음. 재실행용 SQL: supabase/tests/test_room.sql.
- lint, tsc --noEmit, 기존 자동 테스트 44개, Expo 웹 export 통과.
- Android APK 설치 및 개발/운영 실기기 전환은 아직 검증하지 않음.
- 두 방은 같은 DB를 사용하므로 스키마 변경과 서버 장애는 공유함.
