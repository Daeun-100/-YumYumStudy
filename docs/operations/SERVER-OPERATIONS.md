# 서버 운영과 장애 확인

공유 백엔드는 Supabase 프로젝트 `hxwwhgxxvyzqqnxlgqde`다. 이 문서는 기존 구현·검증 기록에서 운영에 필요한 절차를 모은 것이다. 과거 적용 결과가 지금의 서버 상태를 보장하지 않으므로 변경 전 연결 대상, 함수 정의, 마이그레이션 이력과 앱 호환성을 다시 확인한다. 앱 배포는 [버전 및 배포 운영](RELEASES.md), 관리자 작업은 [관리자 연차](ADMIN-LEAVE.md)와 [스킨 운영](CHARACTER-SKINS-OPERATIONS.md)을 따른다.

## DB 연결과 마이그레이션

- `supabase/config.toml`은 저장소에서 관리하고 CLI 인증과 `.temp/` 연결 메타데이터는 커밋하지 않는다. 로컬 도구 경로는 `/opt/homebrew/bin/supabase`, `/opt/homebrew/opt/libpq/bin/psql`을 사용한 기록이 있다. 다른 환경에서는 설치 경로·버전·`--help`를 확인한다.
- SQL Editor로 먼저 반영하고 CLI 이력은 나중에 등록한 변경이 있다. `migration list`와 `db push --dry-run`으로 실제 적용 상태를 대조한 뒤 미적용 파일만 처리한다. 이력이 없다는 이유만으로 기존 SQL을 재실행하지 않는다.
- `010/100/110/111/200/210/220/230`은 2026-10-26 함수·테이블·권한을 대조한 후 이력을 정합화했다. `supabase/maintenance/reconcile-history-20261026.sql`은 당시 정리용이며 새 DB 마이그레이션에 포함하거나 운영 서버에 재실행하지 않는다. 등록 당시 statements는 NULL이고 원본 SQL은 `supabase/migrations/`에 있다.
- 방 분리·입장·캐릭터·친구 기록·예약 변경·Android 이탈·포스트잇·알림에도 수동 반영 기록이 있다. 초기 보고서의 ‘CLI 이력 미등록’만으로 현재 상태를 단정하지 않는다. 특히 검은고양이 저장 실패는 `profiles_character_check`와 `set_profile`의 지원 ID를 함께 확인한다.
- 관리자 연차와 스킨은 2026-10-28 서버 적용·이력 등록 기록이 있다. 새 응답 종류나 스킨 이미지를 이해하는 앱이 배포됐는지 확인한 뒤 실제 지급한다.
- 기존 데이터가 있는 서버에 초기화·전체 재생을 실행하지 않는다. 원격 함수·제약·RLS·권한·Realtime publication을 확인하고 해당 변경만 반영한다.

읽기 전용 연결 확인 예시:

```bash
supabase db query --linked 'select current_database();'
```

## 방·입장·연차 확인

- 0번 테스트 방과 1번 실제 방은 같은 DB를 사용한다. 방별 데이터·인증 저장 키는 분리하지만 스키마 변경과 서버 장애는 공유한다. 기존 UID의 방을 변경하거나 기록을 옮겨 문제를 해결하지 않는다.
- 실제 초대 코드는 2026-10-27 해시 등록·일치 검증 기록이 있다. `room_invites`에는 해시를 저장하며 원문을 앱·공개 환경 변수·Git에 넣지 않는다. 코드 교체는 기존 입장 자격을 취소하지 않는다.
- `INVITE_NOT_CONFIGURED`, 이름 미완료, 잘못된 방은 서로 다른 실패다. 인증 성공과 입장 완료를 구분하며 `room_onboarding.sql`로 우회 차단·단계 복원을 검사한다.
- 무료 연차는 월요일 06:00 KST(일요일 21:00 UTC) 지급 작업과 조회 시 보충을 사용한다. 자동 지급 시작은 2026-11-02이며 2026-10-26 주간분은 별도 지시 없이 지급하지 않는다. 내부 지급 함수는 앱 역할에 공개하지 않는다.
- 구형 앱은 free/admin 연차 응답을 거부할 수 있다. 신규 종류 지급 전 디코더와 앱 배포 상태를 확인한다. 보상 지급의 실제 획득 시각과 DB에 기록한 시각은 다를 수 있다.

## 친구 부르기 알림

- 서버 구성은 `310_friend_calls.sql`, `311_friend_call_receipts.sql`, `call-friend` Edge Function이다. 함수 액션은 `config/register/status/disable/send`이며 비공개 기기·메시지·영수증 데이터를 다룬다.
- `supabase/config.toml`의 `verify_jwt=false`는 함수 내부의 매 요청 `auth.getUser(token)` 검증을 전제로 한다. 서버가 사용자·입장·방·대상과 쿨다운을 확인한다. 인증을 생략하는 설정으로 해석하지 않는다.
- Android는 Expo Push → FCM V1, iPhone은 HTTPS 홈 화면 웹앱 → Web Push/VAPID를 사용한다. Firebase 프로젝트는 `yumyumstudy-116e0`이며 실제/test Android 앱에 FCM 키를 등록한 기록이 있다.
- `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`는 서버 Secrets에서 관리하고 앱은 공개키만 받는다. VAPID 키를 재생성하면 기존 구독에 영향을 준다. 기존 백업 위치는 Git/EAS에서 제외된 `builds/push-secrets/`다. Firebase 서비스 계정 비공개 키도 앱·Git에 넣지 않는다. `google-services.json`은 이 비공개 키와 다른 공개 앱 구성이다.
- 등록은 사용자당 최대 5기기이고 해제는 현재 기기에 적용한다. Android는 알림 권한과 수신 등록, iPhone은 HTTPS·홈 화면 설치·수신 등록을 확인한다. 두 기기는 같은 방이어야 한다.
- `accepted`는 전송 서비스 접수이며 실제 도착 보장이 아니다. Expo 영수증은 15초 후 확인하고 준비되지 않았다면 같은 요청 조회에서 다시 확인한다. 중간 종료된 pending/unknown 요청은 자동 재발송하지 않으며 별도 정기 전송 재시도도 없다.
- 외부 전송 목적지는 고정 Expo API와 허용한 Apple/Google/Mozilla Web Push 호스트로 제한한다. 만료된 기기는 비활성화하고 메시지·기기 주소·토큰·비밀키는 로그로 출력하지 않는다.
- 등록 요청이 반복되면 네이티브 토큰 이벤트 → Expo 토큰 재조회 순환을 확인한다. 이벤트가 전달한 DevicePushToken을 재사용하고, 동시 등록 공유·최신 토큰 후속 처리·실패 후 재시도를 보존한다. 등록 호출 수와 사용자가 보낸 알림 수는 다르다.
- 실기기 수신·잠금 화면·소리·진동은 서버 접수 검사와 별도로 확인한다. 무음·집중 모드·권한·네트워크·강제 종료가 도착에 영향을 준다. 실제 발송은 사용자가 요청한 범위에서만 수행한다.

## Discord 로그 감시

설정 기준은 `supabase/functions/log-monitor/`와 `20261027075804_scheduled_discord_log_monitor.sql`이다. 2026-10-27 활성화·인증된 dry run 검증 기록이 있으며, 운영 상태는 함수·cron을 직접 조회해 확인한다.

- KST 매일 15:10, 16:10, 17:10, 19:10, 20:10, 21:10, 22:10에 직전 10분을 검사한다. UTC cron은 `10 6,7,8,10,11,12,13 * * *`다. 하루 70분 표본이며 상시 감시가 아니다.
- API Gateway `edge_logs`와 Edge Functions `function_edge_logs`를 각각 집계하고 겹치는 요청 수를 합치지 않는다. OPTIONS와 감시 함수 자체는 제외한다.
- 정상·복구·빈 구간에는 알리지 않는다. 빈 구간은 `no_observations`이며 정상의 증거가 아니다. 로그 조회 실패는 감시 실패로 구분해 알린다.

| 조건 | 알림 기준 |
| --- | --- |
| 한 초의 최대 요청 수 | 1,000 이상 |
| 한 분의 최대 요청 수 | 3,000 이상 |
| 10분 내 HTTP 5xx | 20건 이상이면서 유효 HTTP 응답의 5% 이상 |

한 실행의 발견 사항은 Discord 메시지 하나로 합친다. 기준은 운영 초기값이며 서비스 한도가 아니다. 변경은 `policy.ts`에 반영하고 함수를 재배포한다. egress·청구액·IP별 사용자·Postgres 오류·Realtime 메시지량을 측정하지 않는다.

Secrets는 다음과 같다. 값은 공개 환경 변수·앱·로그·커밋에 넣지 않는다.

| Secret | 용도 |
| --- | --- |
| `DISCORD_WEBHOOK_URL` | Discord 목적지 |
| `MONITOR_CRON_SECRET` | 함수 bearer 인증. Vault `log_monitor_cron_secret`과 일치해야 함 |
| `MONITOR_MANAGEMENT_TOKEN` | 해당 프로젝트 `analytics_logs_read` 전용 PAT. 계정 전체 CLI 토큰을 대신 넣지 않음 |

최초 구성은 Secrets → 함수 → 비활성 cron 마이그레이션 → 인증된 dry run → cron 활성화 순이다. 이미 운영 중인 서버에 초기 마이그레이션을 재실행하면 작업이 비활성화되므로 재생하지 않는다. 다른 프로젝트로 옮길 때는 마이그레이션의 프로젝트 URL도 확인한다.

dry run은 `/functions/v1/log-monitor`에 `Authorization: Bearer <MONITOR_CRON_SECRET>`과 `{ "dry_run": true }`를 POST한다. 선택 입력 `end`는 최근 24시간 안의 UTC 구간 끝이다. dry run은 오류가 나도 Discord로 보내지 않는다. 일반 실행은 정해진 일곱 슬롯과 최대 5분 지연만 허용한다.

실행 결과는 Edge Function 로그, `cron.job`, `cron.job_run_details`, `net._http_response`에서 확인한다. cron 성공은 HTTP 요청 접수이며 함수 성공을 뜻하지 않는다. 자동 재시도는 없고 수동 재실행은 중복 알림을 낼 수 있다. 전용 PAT 만료·폐기로 조회가 멈출 수 있으며 감시 서버·Discord 장애 시 알림 자체도 실패할 수 있다.

중지 SQL:

```sql
select cron.alter_job(jobid, active := false)
from cron.job where jobname = 'discord-log-monitor';
```

월 정기 호출 수는 30일 210회, 31일 217회이며 수동 검사 호출은 별도다. 스캔 용량과 로그 보관 비용은 호출 수만으로 계산하지 않는다.

## 재현 검사와 검증 범위

- 일반 `npm test`는 외부 서비스에 쓰지 않는다. `scripts/check-supabase.mjs`는 연결 확인용이며 `--anonymous`는 실행마다 익명 사용자를 생성한다. `scripts/check-study-core.mjs --run`도 테스트 사용자와 종료 세션을 생성한다. 실제 방에서 무심코 반복 실행하지 않는다.
- 초기 연결·코어 검사에서 `connection_test`, `study_core_test` metadata가 있는 익명 계정과 테스트 프로필을 남긴 기록이 있다. 자동 삭제하지 말고 현재 사용자·기록과 구분해 확인한다. 표시 이름만으로 소유권을 판정하지 않는다.
- DB 경계·권한 검사는 `supabase/tests/`의 SQL을 확인한다. 임시 프로필·설정·기록 변경은 트랜잭션 롤백으로 되돌린다. 실제 전송·운영 지급·cron 활성화는 롤백 SQL 검사와 구분한다.
- 연차 요청 API는 `mutate_leave`다. `leave_states.sql`의 초기 unversioned 호출은 210/220 단계 검사이며 최신 변경 권한은 `leave_requests.sql`로 확인한다. `leave_concurrency_holder.sql`과 `leave_concurrency_contender.sql`은 두 독립 연결에서 프로필 잠금 경합을 검사한다.
- 스킨 검증에는 격리 DB와 실제 서버 롤백 검사가 모두 있었지만, 대체 환경의 cron/Vault/Realtime 검사를 실제 전송 검증으로 보지 않는다. Android/iPhone의 최종 표시·알림 도착·기기 간 전파·오프라인 복구는 배포 대상 버전에서 별도로 확인한다.
