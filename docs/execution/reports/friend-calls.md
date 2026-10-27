# 친구 부르기 — 2026-10-27

## 구현

- 집중방의 쉬는 친구 이름표를 누르면 40자 메시지 모달을 연다. 이름표 문구·공부시간은 유지한다.
- 같은 방의 입장·이름 설정을 완료한 친구만 대상이다. 자기 자신과 공부 중인 친구는 제외한다.
- 수신자 기준 5분 동안 한 번만 전송한다. 다른 발신자의 요청도 같은 제한을 적용한다.
- 모달 안, 입력칸 아래와 전송 버튼 사이에 서버 오류를 안내한다.
- 나 → 친구 부르기 알림에서 기기별 수신 등록/해제를 제공한다. 첫 실행에 권한을 강제로 요청하지 않는다.
- Android: Expo Notifications → Expo Push → FCM V1. 기존 타이머 알림과 별도의 friend-calls 채널. 작은 단색 로고와 컬러 큰 로고를 앱에 포함한다.
- iPhone: 홈 화면 웹앱 → Service Worker + Web Push/VAPID. 알림은 로고, `이름님이 불렀어요!`, 작성 메시지. 시스템이 앱 이름/배치를 추가할 수 있다.
- 알림 터치 시 공부방으로 이동한다. 공부를 자동 시작하지 않는다. 다른 방의 알림은 자동으로 방을 바꾸지 않는다.
- Service Worker는 앱 화면/API/인증 응답을 캐시하지 않는다.

## 서버

Supabase 프로젝트 hxwwhgxxvyzqqnxlgqde에 다음을 배포했다.

- 310_friend_calls.sql: 비공개 기기·메시지 테이블, 서비스 전용 등록/전송 예약 RPC.
- 311_friend_call_receipts.sql: 비공개 Expo 전송 영수증 테이블.
- call-friend Edge Function: config/register/status/disable/send.
- WEB_PUSH_PUBLIC_KEY와 WEB_PUSH_PRIVATE_KEY를 서버 Secrets에 저장했다. 앱은 공개키만 받는다.
- 사용자의 명시적 승인 후 gateway JWT 검사를 대신해 함수가 매 요청에서 auth.getUser(token)로 토큰을 검증한다. 방도 서버에서 재확인한다. Supabase config.toml에도 verify_jwt=false를 기록한다.
- 외부 전송 URL은 고정 Expo API 또는 허용한 Apple/Google/Mozilla Web Push 호스트만 사용한다.
- 요청 ID를 중복 처리하지 않는다. 네트워크 응답이 유실되면 같은 ID로 결과만 조회한다. 중간 종료된 pending/unknown 요청을 자동 재발송하지 않는다.
- 전송 서비스 접수와 기기 도착을 구분한다. accepted는 기기 도착 보장이 아니다. Expo 영수증은 15초 후 확인하며 아직 준비되지 않은 영수증은 같은 요청 조회 때 다시 확인한다. 별도 정기 재시도 작업은 없다.
- 만료된 기기는 사용 중지한다. 메시지/기기 주소/토큰/비밀키는 서버 코드에서 로그로 출력하지 않는다.

## 검증

- lint/typecheck 통과.
- 전체 자동 테스트 92개 통과(SSRF, Unicode 메시지, 웹 알림 내용·클릭 경로 포함).
- 실제 DB 트랜잭션 검사: 같은 방/활성 세션/중복/쿨다운/권한/입력 제한 통과. 테스트 데이터는 rollback.
- 배포 함수 HTTP 검사: 무인증·잘못된 토큰 401, 방 불일치 403, SSRF 목적지 400, 공개키 응답·기기 등록·소유권·해제·미등록 수신자 차단 확인. 임시 계정/기기는 삭제 완료. 실제 친구에게 푸시하지 않았다. 실제 Expo 전송 API에서 가짜/만료 토큰 거부와 기기 자동 비활성화 및 같은 요청 재조회도 검증했다.
- Deno 타입 검사 및 실제 VAPID 키를 사용한 Web Push 암호화 패킷 생성 검증 통과(네트워크 전송 없음).
- 웹 export 성공. public/index.html에 manifest 및 홈 화면 아이콘 링크 포함 확인.
- 실제 앱 이름표 클릭 → 모달 및 프로필 수신 설정 화면 확인.

## 전달·운영

- Firebase 프로젝트 yumyumstudy-116e0, 실제/test Android 앱에 FCM V1 키 등록 완료.
- iPhone HTTPS 웹 배포는 사용자 요청으로 보류. 로컬 dist/ 파일에 구현을 포함한다. iPhone은 배포 후 Safari → 공유 → 홈 화면에 추가 → 나 → 부르기 알림 켜기가 필요하다.
- Android는 새 테스트 APK 설치 후 나 → 부르기 알림 켜기. 두 기기에서 같은 방을 선택해야 한다.
- 실기기 간 알림 도착·잠금 화면·소리/진동 확인은 아직 하지 않았다. 무음/집중 모드/OS 권한/네트워크/강제 종료 상태에 따라 표시가 제한될 수 있다.
- 기기 등록은 사용자당 최대 5개. 비활성화는 현재 기기에 적용한다.
- VAPID 키는 함부로 재생성하지 않는다(기존 웹 구독과 연결됨). 로컬 백업은 Git/EAS에서 제외된 builds/push-secrets/에 제한된 권한으로 보관한다. Firebase 서비스 계정 원본은 Downloads에 있으며 앱/Git에 넣지 않는다.
- google-services.json은 앱 식별용 공개 구성 파일이다. Firebase 서비스 계정 비공개 키와 다르다.

## Android 빌드 결과

- 새 로컬 테스트 APK: builds/yumyumstudy-test.apk, 약 57.2 MiB, ARM64.
- ID com.yumyumstudy.app.test / 얌얌스터디 테스트 / 1.0.0(1).
- SHA-256: f64669a261c8f1721633365531cacc90db76ff69ef3dbd4d0a1deec520cf50ff.
- 첫 빌드는 포장 단계 Metaspace 512MB 제한으로 실패했다. GRADLE_OPTS의 org.gradle.jvmargs에 -Xmx2048m -XX:MaxMetaspaceSize=1024m를 지정한 재빌드는 성공했다. 생성된 native 프로젝트를 수동 수정하지 않았다.
- APK 서명 검증 통과. 연결된 휴대폰이 없어 설치/실기기 수신 검증은 미진행.
