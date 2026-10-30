# Android 종료 진단

## S25 최근 앱 복귀 실패: 실기기에서 확인한 내용

2026-10-30 S25(SM-S931N, 기기 속성 Android 17 / One UI 90000), 앱 1.1.0(versionCode 4)에서 최근 앱 카드 선택 시 아래 시스템 오류가 반복됐다.

```text
ActivityTaskManager: IllegalArgumentException: Caller with mInTask ...
has root ActivityRecord ... but target is singleInstance/Task
startActivity: reason=startActivityFromRecents, result=-96
HoneySpace.Task: Failed to launch task
```

실패 후에도 동일 앱 프로세스와 MainActivity가 존재했고 화면 상태는 STOPPED였다. 설치 상태는 suspended=false, quarantined=false였다. 이번 재현의 직접 실패 지점은 프로세스 종료가 아니라 시스템의 기존 작업 재실행이다. AOSP ActivityStarter의 기존 root가 있는 명시적 작업에 singleTask/singleInstance를 시작하는 방어 조건과 일치한다. 삼성 시스템이 그 경로로 진입한 이유까지 확정한 것은 아니다.

`plugins/withAndroidRecents.js`로 MainActivity를 singleTop으로 설정하여 해당 조건을 피하는 호환성 수정을 적용한다. 생성된 android 폴더를 직접 수정하지 않는다. singleTop은 기존 화면이 맨 위에 있을 때 재사용하며 singleTask와 모든 경우의 의미가 같지는 않다. 별도 네이티브 화면을 추가하면 작업 중복 여부를 다시 확인한다.

배포 전 S25에서 새 APK로 다음을 확인해야 한다: 타이머 미실행/실행 각각 홈 → 최근 앱 복귀 반복, 화면 잠금 후 복귀, 타이머 알림에서 복귀, 앱 실행 중/종료 후 딥링크 진입, 최근 앱 카드 중복 여부. 빌드 및 설정 검증은 실제 재진입 성공 검증을 대체하지 않는다. 이 변경은 OTA로 적용할 수 없다.

근거: [AOSP ActivityStarter](https://android.googlesource.com/platform/frameworks/base/+/master/services/core/java/com/android/server/wm/ActivityStarter.java), [Android launch modes](https://developer.android.com/guide/components/activities/tasks-and-back-stack).

Android 11(API 30) 이상에서 다음 프로세스 시작 시 OS의 `ApplicationExitInfo`를 수집한다. 최근 7일의 메인 프로세스 기록 중 최대 16개를 기기에 보관하고, 로그인·입장이 완료된 다음 앱 활성화 및 활성 상태의 60초 간격으로 전송한다. 서버 성공 응답 후에만 기기 기록을 지운다. 전송 응답 유실은 `(reporter_id, event_id)`로 중복 제거한다. 진단 실패는 앱 시작을 막지 않는다.

## 적용 순서

1. 정상 DB 배포 절차로 `20261030084116_android_exit_diagnostics.sql` 마이그레이션을 적용한다.
2. 네이티브 변경을 포함한 새 APK를 기존 릴리스 절차로 배포한다. OTA만으로 수집 기능을 추가할 수 없다. APK 버전과 versionCode 증가는 릴리스 단계에서 처리한다.
3. 해당 APK에서 프로세스 종료 후 재실행하면 서버 수집을 확인한다. 기존 APK와 웹에서는 새 메서드가 없어 수집하지 않는다.

## 운영 조회

관리자 SQL 콘솔에서 조회한다. 일반 앱 계정은 자기 방의 자기 보고서만 읽고 추가할 수 있으며 수정·삭제할 수 없다.

```sql
select p.display_name, d.received_at, d.exited_at, d.reason,
       d.exit_status, d.importance, d.pss_kb, d.rss_kb,
       d.manufacturer, d.model, d.sdk, d.native_version, d.native_build,
       d.service_event, d.service_at, d.reporting_version, d.reporting_build
from public.android_exit_diagnostics d
join public.profiles p on p.id = d.reporter_id
where d.room_id = 1 and p.display_name = '수빈'
order by d.received_at desc
limit 50;
```

대표 reason: 3 저메모리, 4 Java 크래시, 5 네이티브 크래시, 6 ANR, 10 사용자 요청 종료. 전체 의미는 [Android ApplicationExitInfo](https://developer.android.com/reference/android/app/ApplicationExitInfo)를 확인한다. 숫자만으로 One UI 복귀 실패의 원인을 확정하지 않는다.

`reporter_id`는 **다음 실행에서 보고한 계정**이다. 종료 당시 계정이라는 보장은 없다. `native_version/build`는 직전 프로세스 PID와 시작 시간이 일치할 때만 채우며, `reporting_version/build`는 업로드 앱의 버전이다. `service_event`는 마지막 서비스 생명주기 한 건으로 전체 이력이 아니며, 강제 종료 시 onDestroy가 호출되지 않을 수 있다.

OS가 프로세스를 종료하지 않고 최근 앱 작업 열기만 거부했다면 종료 기록이 없을 수 있다. 이 수집은 시스템 런처 로그나 크래시 스택을 대체하지 않는다. 원문 예외, 스택, 토큰, 다른 앱 사용 내역은 보내지 않는다. 클라이언트가 제출한 진단이므로 보안·과금 판정 근거로 사용하지 않는다.

기기 보관은 개수 제한으로 오래된 미전송 기록이 제거될 수 있다. 서버는 자동 삭제하지 않으므로 운영자가 보존 기간을 정하고 관리자 권한으로 정리한다. 예를 들어 90일 보존 정책을 적용할 때:

```sql
delete from public.android_exit_diagnostics
where received_at < now() - interval '90 days';
```

## 검증

JS 업로드 테스트는 재시도, 중복 실행 병합, 응답 후 acknowledge 순서를 확인한다. PGlite DB 테스트는 RPC 중복 제거, 방/사용자 RLS, 익명 호출 거부, 입력 제약을 확인하며 CI에서 함께 실행한다. 실제 Galaxy의 최근 앱 복귀는 별도 기기 확인이 필요하다.
