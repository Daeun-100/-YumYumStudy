# 관리자 토스트 운영

관리자 채팅으로 방 전체 또는 지정 사용자에게 앱 내부 안내를 보내고 삭제한다. 업데이트 안내는 기존 ‘업데이트가 준비됐어요’를 사용하고 문구를 입력하지 않는다. 일반 안내는 명시한 제목·본문을 공통 토스트로 표시한다.

## 최초 서버 준비

이 기능 PR을 병합하는 것만으로 운영 발송이 시작되지는 않는다. 기존 서버 배포 절차에서 아래 준비를 완료한다.

1. `admin_toasts` migration을 검증 후 적용한다. 운영 DB 백업·migration 정책을 따른다.
2. `admin-toasts` Edge Function을 배포한다. `supabase/config.toml`의 `verify_jwt=false`는 관리자 토큰 인증을 함수가 직접 하기 때문이다.
3. 64자 이상의 무작위 `ADMIN_TOAST_TOKEN`을 서버 secret으로 등록한다. 기존 푸시 관리자 토큰과 별도 값을 사용한다.
4. 운영 Mac의 `~/.codex/skills/yumyum-send-toast/private/admin.json`에 `{"token":"<비밀값>"}`을 저장하고 권한을 0600으로 한다. 이 파일은 Git에 넣지 않는다.
5. Realtime private 채널과 기존 정책을 검토하고 Supabase advisors를 확인한다. 첫 안내는 테스트 방에서 검증한다.
6. 앱을 기존 develop → master 절차로 배포한다. 안내 수신 코드가 반영된 앱부터 동작한다. 서버·앱 모두 준비될 때까지 안내를 만들지 않는다.

기본 유효기간은 일반 안내 24시간, 업데이트 안내 7일이다. 최대 30일이다. 명시한 날짜·시각을 사용하며 한국 시간으로 결과를 안내한다.

## 명령 사용

아래 도구는 관리자 API를 실제 호출한다. 파일에는 개인 UUID·운영 안내가 포함될 수 있으므로 임시 입력·결과 파일도 `umask 077`로 생성하고 작업 후 삭제한다. 비밀 토큰은 도구가 private 설정 파일에서 읽으며 출력하지 않는다. Node 22.13 이상을 사용한다.

```bash
node --experimental-strip-types scripts/admin-toasts.mjs preview /private/tmp/toast-input.json
node --experimental-strip-types scripts/admin-toasts.mjs create /private/tmp/toast-preview-result.json
node --experimental-strip-types scripts/admin-toasts.mjs status /private/tmp/toast-status.json
```

preview 출력 전체를 보관한 뒤 create에 그대로 입력한다. 출력의 `prepared`에 요청 UUID·안내 UUID·시작/종료가 고정된다. 운영 대상이 명확한 발송 요청이면 preview 결과를 검증한 뒤 지시 범위 안에서 실행한다. 불명확한 방·동명이인·배포 대상을 추측하지 않는다.

일반 안내 preview 입력 예시:

```json
{
  "roomId": 1,
  "kind": "info_notice",
  "appVariant": "production",
  "userIds": null,
  "payload": { "title": "점검 안내", "message": "오늘 밤 11시에 점검이 있어요." }
}
```

`userIds: null`은 방 전체다. 특정 사용자만이면 서버에서 해당 방 입장 완료 상태를 확인한 UUID 목록을 넣는다. 방 전체는 유효기간 중 새로 입장한 사용자도 포함한다. `appVariant`는 필수이며 production은 1번방만 허용한다. test 빌드는 0·1번방을 사용할 수 있다.

업데이트 안내는 성공한 production Android OTA 배포의 CI artifact를 다운로드해 다음 입력으로 preview한다.

```json
{
  "roomId": 1,
  "kind": "update_ready",
  "appVariant": "production",
  "deploymentFiles": {
    "record": "/private/tmp/deployment/update-record.json",
    "easResponse": "/private/tmp/deployment/eas-update.json",
    "plan": "/private/tmp/deployment/deployment-plan.json"
  }
}
```

도구는 성공 상태, 커밋, runtime, APK 기준과 EAS 플랫폼별 update ID·group ID를 대조한다. artifact는 해당 저장소의 검증된 성공 run에서만 가져온다. API의 payload 직접 입력은 서버·로컬 테스트 또는 이미 검증한 배포 식별자를 사용할 때만 쓴다. ‘이번 업데이트’가 모호하면 배포 시각과 후보를 확인한다. revision 태그의 문자열 정렬로 최신을 추측하지 않는다.

실제 업데이트 안내는 다운로드 완료·미적용·정확한 UUID/runtime/channel 일치를 모두 만족할 때만 표시한다. 이미 적용했거나 다른 업데이트를 받은 기기는 제외한다. 웹·Expo Go·개발 모드에서는 실제 OTA 안내가 없다. 테스트 채널은 검증된 test 배포 ID를 직접 구성하고 같은 API 입력 검증을 따른다.

## 안내 삭제와 다시 보내기

`delete`는 다음 파일을 입력한다. requestId는 이 삭제 작업의 새 UUID이고 campaignId는 발송 결과나 status에서 읽는다. 삭제에 버전 번호는 필요하지 않다.

```json
{
  "requestId": "<이번 삭제 UUID>",
  "campaignId": "<안내 UUID>"
}
```

```bash
node --experimental-strip-types scripts/admin-toasts.mjs delete /private/tmp/toast-delete.json
```

삭제는 서버의 `deleted_at`을 기록하고 앱 조회·실시간 재조회 목록에서 제외한다. 표시·대기 중인 안내도 다음 조회 때 제거한다. 안내·발송·표시 이력은 보존 기간 동안 남는다. 같은 요청 UUID로 재시도하면 최초 삭제 결과를 반환하며 이미 삭제한 안내를 다시 삭제해도 삭제 시각과 revision을 바꾸지 않는다.

삭제한 안내는 다시 켜거나 복원할 수 없다. 다시 알리려면 새 요청 UUID·안내 UUID로 preview → create를 실행한다. 새 안내이므로 이전 안내를 완료한 설치에도 표시될 수 있다. 기존 안내의 문구·대상·기간을 덮어쓰는 API와 별도 resend API는 없다.

`list` 입력은 `requestId`, `roomId`이고 삭제되지 않은 최근 100건을 반환한다. 삭제 이력은 campaignId를 지정한 status로 조회한다. `status`는 `requestId`만 입력하면 해당 요청의 처리 결과를, `campaignId`도 입력하면 그 안내의 설정과 표시 집계를 반환한다. status 조회용 requestId는 UUID 형식이며 조회를 위해 새로 만들 수도 있다. 결과 불명인 요청의 복구에는 반드시 원래 requestId를 사용한다.

## 결과 해석과 복구

- `saved`는 새 안내 저장 성공이고 `deleted`는 삭제 처리 성공이다. 실제 표시 완료나 온라인 전원 도달을 뜻하지 않는다.
- 사용자 앱은 private Broadcast를 신호로 받아 목록을 재조회하고, 전경에서는 약 60초 간격으로 보완 조회한다. 배경에서는 주기 조회를 멈추고 복귀 시 다시 확인한다.
- 공부·저장·모달·키보드 중에는 보류한다. 업데이트 토스트는 X 또는 업데이트 영역 표시 확인으로 완료한다. 일반 안내는 실제 표시하면 완료로 기록하고 6초 뒤 닫힌다.
- 같은 사용자라도 다른 설치에서 다시 표시될 수 있다. 설치 삭제·저장소 초기화·저장 실패까지 포함한 정확히 한 번 표시는 보장하지 않는다.
- `shownInstallations`, `completedInstallations`, `shownUsers`는 앱 보고치다. 미보고가 미표시를 증명하지는 않는다.
- 타임아웃·5xx·연결 종료가 나면 같은 요청 UUID의 status부터 조회한다. `not_found`라면 저장한 입력과 같은 UUID로 재시도한다. 새 UUID로 재발송하지 않는다.
- 409는 같은 UUID로 다른 입력을 보낸 경우다. status를 읽고 사용자가 요청한 변경이 여전히 유효한지 판단한다.
- 관리자 삭제·만료는 재조회한 앱의 표시·대기 안내를 제거한다. 오프라인 기기에 즉시 강제할 수 없으므로 마지막 조회 후 90초가 지나면 앱이 안내를 숨긴다.
- 관리자 안내를 삭제해도 OTA 다운로드와 수동 적용은 유지된다. 이 도구는 OS 푸시를 발송하지 않는다.

## 검증

```bash
npm run lint
npm run typecheck
node --experimental-strip-types --test tests/admin-toasts*.test.mjs tests/toast-store.test.mjs
```

SQL 통합 테스트는 임시 PostgreSQL WASM 런타임으로 실행할 수 있다. 앱 의존성에는 추가하지 않는다.

```bash
npm install --prefix /private/tmp/toast-db-tests --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.3.14
PGLITE_MODULE=/private/tmp/toast-db-tests/node_modules/@electric-sql/pglite/dist/index.js node --experimental-strip-types --test tests/admin-toasts-db.test.mjs
```

이 테스트는 실제 PostgreSQL grants·RLS·트랜잭션을 검사하며 Supabase Realtime과 Cron 전송은 stub이다. 출시 전 테스트 방에서 실제 Broadcast, 연결 복구, Android OTA 다운로드·적용 조건, native 접근성을 추가 검증한다. Storybook의 `공통 컴포넌트/토스트 · EAS 업데이트`는 앱과 같은 표시 컴포넌트를 사용한다.

[320px 웹 토스트 확인 화면](../development/assets/admin-toast-small.png)

## 2026년 10월 30일 테스트 반영 기록

- 서버 migration `20261029154511_admin_toasts` 적용, `admin-toasts` Edge Function 배포와 전용 관리자 토큰 설정 완료.
- 테스트 채널 `test` / EAS 환경 `preview` / Android OTA 그룹 `5cd0c273-040e-4f1c-8b92-ec4b0e5f6dde` 게시 완료. 앱 소스는 PR #52의 `9d19dd7`이다.
- 런타임 `16a730161794c57f595e156bedaaf353630dde66`이며 기존 테스트 APK와 일치한다. production 채널에는 게시하지 않았다.
- 같은 앱 소스로 로컬 테스트 APK 1.1.0 / versionCode 4 생성. 앱 ID는 `com.yumyumstudy.app.test`다.
- 관리자 API의 테스트 방 목록 조회 HTTP 200, 앱 역할의 관리자 RPC 실행 거부, anon 조회 거부, 정리 작업 활성 상태 확인.
- 안내 데이터는 0건이며 실제 사용자 토스트는 발송하지 않았다. 실제 휴대폰에서 수신·표시·삭제 및 OTA 조건 확인은 사용자 테스트 단계다.
- 보안 advisor의 익명 인증 관련 안내는 프로젝트의 익명 로그인·방 입장 구조에 해당한다. 읽기 정책은 현재 입장한 방·본인 대상 조건을 유지하며 관리자 쓰기는 앱에서 허용하지 않는다. 비공개 요청·감사 테이블은 의도적으로 일반 사용자 정책 없이 차단한다. [Supabase 익명 인증 정책 진단 설명](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins)을 기준으로 입장 검증과 역할 권한을 확인했다.

## 후속 단순화 적용

삭제 요청은 안내 ID와 요청 ID만 사용한다. 이 API를 서버에 반영할 때 추가 migration `simplify_toast_delete`와 최신 `admin-toasts` 함수를 함께 배포한다. 기존 적용 migration은 변경하지 않는다. 예전 요청의 재시도를 위해 전달된 expectedRevision은 입력 해시 보존에만 사용하고 삭제 조건으로 검사하지 않는다. 기존 앱이 읽는 revision 응답 필드는 유지한다.

앱의 1초 갱신은 미완료 안내가 있을 때만 구독한다. 구독이 중단된 동안에도 다음 렌더에서 현재 시간을 읽어 오래된 설정을 잘못 표시하지 않는다. 일반 안내의 제목·본문은 최초 등록 시에만 전달하며 중복 갱신하지 않는다.
