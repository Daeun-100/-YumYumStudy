# 환경 검증 기록

2026-10-26 기준 Expo SDK 58 공식 blank-typescript 템플릿으로 구성했다. Node 22, npm 및 package-lock.json을 사용한다.

- TypeScript 검사 통과.
- Expo ESLint 검사 통과.
- 정적 웹 export 통과.
- Android SDK/JDK 및 실기기가 필요한 네이티브 빌드는 미검증.
- 초기 환경 구성 당시에는 Supabase 연결을 수행하지 않았다. 이후 실제 연결 검사 결과는 아래에 기록한다. 앱 인증 구현·배포·업무 기능은 아직 수행하지 않았으며 로그인 UI는 MVP 범위에서 제외했다.

## Supabase 연결 검사 — 2026-10-26

프로젝트 생성과 `.env.local` 설정 후 실제 Auth API 연결 검사를 수행했다. 위 초기 환경 기록 이후 진행한 검사이며 앱의 인증 기능 구현 완료를 의미하지 않는다.

- 프로젝트 URL·publishable key로 Auth 설정 조회 성공.
- 테스트 익명 사용자 1명 생성 및 UID·인증 세션 발급 성공.
- 발급 세션으로 서버 사용자 재조회, UID 일치 및 익명 사용자 여부 확인 성공.
- 테스트 UID: `966322fe-9ffb-4d1b-b684-be490ecb2ab1`. 사용자 metadata의 `connection_test: true`로 구분할 수 있다.
- 토큰은 메모리에서만 사용하고 파일·로그에 저장하지 않았다. 테스트 사용자는 삭제하지 않았다.
- 앱 내 세션 저장·복원, DB 테이블·RLS, Realtime 및 실기기는 아직 미검증이다.

재검사: `node --env-file=.env.local scripts/check-supabase.mjs`는 연결만 확인한다. `--anonymous`를 추가하면 실행마다 테스트 사용자를 새로 생성하므로 필요할 때만 사용한다.

초기 `npm audit`에서 high 5건이 보고되었다. 의존 경로는 Expo CLI의 node-forge 및 zod이고 상위 패키지의 경고를 포함한 수치다. `npm audit fix`로는 해결되지 않았다. 제안된 `--force`는 Expo 44로 하향 변경하므로 적용하지 않았다. 실제 배포 전 upstream 패치와 의존성을 다시 점검한다.

화면 이동은 AGENTS.md에 따라 Expo Router를 사용한다. 공통 기반 단계에서 Router와 UID 연결 화면을 추가했다.

## 업데이트 안내 — 2026-10-26

- 배포 번호 비교, 플랫폼별 배포 조회, 시작 화면의 안내·다운로드/새로고침·나중에 버튼을 구현했다.
- 실행·복귀 시 업데이트 확인을 연결했다. 사용자 요청으로 사용 중 주기적 확인을 제거했다. 꺼진 앱 OS 푸시는 포함하지 않는다.
- Supabase SQL Editor에서 `010_app_releases.sql`과 동등한 SQL을 실제 적용했다. Android/웹 배포 번호 1, 버전 1.0.0, enabled=false인 2개 행을 확인했다. 이미 적용했으므로 같은 프로젝트에 중복 실행하지 않는다. 추후 CLI 마이그레이션 사용 시 적용 이력을 먼저 맞춘다.
- 실제 공개 키로 REST 조회 성공 및 RLS에 의해 비활성 행이 빈 목록으로 반환됨을 확인했다.
- `npm test` 3개 테스트, 타입 검사, 린트, 웹 export 통과.
- 활성 배포의 실제 사용자 알림, APK 다운로드/업데이트 설치, iPhone 웹 새로고침은 실기기 검증 전이다. 실제 새 배포가 없어 활성 신호를 보내지 않았다.
- 운영 절차: RELEASES.md. 새 라우터로 옮길 때 UpdateNotice는 공통 레이아웃에서 한 번만 렌더링한다.

## 공통 기반 구현 — 2026-10-26

자동 익명 인증·세션 저장/복원, 공통 데이터 타입과 미연결 API 경계, 6시 날짜·서버 기준 표시 시계를 구현했다. 실제 브라우저에서 UID 발급·새로고침 복원·재시도 및 설정 누락 화면을 확인했다. 테스트 12개·린트·타입 검사·웹 export 통과. 프로필 DB 연결과 실제 공부 기능·Android 실기기는 아직 대기이며 상세 인계는 execution/reports/00.md에 기록한다.

## DB 코어 구현 — 2026-10-26

100_study_core.sql을 실제 Supabase에 적용하고 프로필·시작/중지·오늘/방/목표/기록 조회·Realtime을 연결했다. 무인증/타인 변경 차단, 중복·동시 요청, Realtime INSERT/UPDATE, 6시 경계·진행 시간 분리·목표 이력 계산을 실제 서비스에서 검증했다. 테스트 15개·타입 검사·린트 통과. 로컬 Docker 엔진은 꺼져 있어 로컬 새 DB 검증은 대기다. 상세 결과와 테스트 계정 4명은 execution/reports/01.md에 기록했다. 실제 타이머/친구/기록 화면과 실기기 검증은 후속 단계다.

## 목표 저장·출석 — 2026-10-26

110/111 마이그레이션을 원격에 적용했다. 다음 공부 날짜 목표 예약, 0~1,440분·휴무/미설정 구분, 진행 중 포함 1초 출석, 별도 목표 달성 상태를 구현했다. 빈 날짜 시간 합산 오류와 Realtime 수신 준비 시점도 보완했다. 자동 검사 20개·실제 API/SQL 경계 검사·타입 검사·린트·웹 export를 통과했다. UI·실기기는 후속 단계다. 상세 결과와 테스트 계정은 execution/reports/goals-attendance-core.md를 참고한다.

## 연차 지급·만료 기반 — 2026-10-26

200을 원격 적용했다. 주당 6일 목표 달성(진행 중 포함)·1개 지급·획득 주 시작+21일 만료, UID/주 중복 방지, 본인 지급 내역·잔액 RPC를 구현했다. 조회 때 기록하지만 실제 달성 시각을 보존한다. 실제 SQL 경계·RLS 검증과 자동 테스트 29개·타입 검사·린트 통과. 사용·취소·차감·출석 대체·UI는 미구현이며 execution/reports/leave-foundation.md에 범위를 기록했다.

## 연차 4상태·예약/취소 — 2026-10-26

210을 SQL Editor로 원격 적용했다(CLI 이력 미등록, 재실행 금지). 상태/잔액/예약/취소 및 실제 DB 롤백 테스트 완료. 자동 테스트 34개·타입 검사·린트 통과. 사용일 기준은 한국시간 06:00, 미래 날짜 및 만료 전만 예약 가능하다. 사용자 요청에 따라 연차 UI는 보류한다. 상세 검증과 제한은 execution/reports/leave-states.md에 기록했다.

연차 동시성 추가 검증: 두 독립 DB 연결에서 예약 트랜잭션 유지 중 같은 계정의 예약·취소·조회가 프로필 잠금에 대기함을 확인했다. 잠금 해제 후 재조회 성공, 두 트랜잭션 모두 롤백. 재현 SQL은 supabase/tests/leave_concurrency_holder.sql 및 leave_concurrency_contender.sql이다.

## 연차 출석·지급 제외·하루 1개 — 2026-10-26

220을 원격 SQL Editor로 적용했다(CLI 이력 미등록). 연차일 attendance=leave, 연차일은 주 6일 지급 계산에서 제외, 사용자당 날짜별 1개 제한을 구현했다. 실제 공부 시간은 보존한다. DB 경계·중복·취소 후 재예약 롤백 테스트 및 자동 테스트 36개·타입 검사·린트 통과. 연차 UI는 보류한다.

## 연차 갱신·요청 보호·자동 선택 — 2026-10-26

230 원격 적용 완료(CLI 이력 미등록). LeaveProvider의 시작/복귀/목표·날짜·연차 경계 갱신, 요청 ID·예약 버전 및 기기 저장을 통한 재전송 보호, 만료 임박 자동 선택 구현. 실제 DB 롤백 테스트와 자동 테스트 42개·타입 검사·린트·웹 export 통과. 연차 화면은 보류.


## DB 적용 이력 정리·복구·목표 화면 — 2026-10-26

- 이전 항목의 “CLI 이력 미등록” 상태를 해소했다. 운영 프로젝트 hxwwhgxxvyzqqnxlgqde에서 함수 20개 본문(공백/주석 정규화), 테이블 8개 컬럼/RLS/권한, 제약·인덱스·정책·Realtime publication을 저장소와 대조했다.
- supabase_migrations.schema_migrations에 010/100/110/111/200/210/220/230과 파일 이름을 등록했다. 앱 테이블과 업무 함수는 재실행하지 않았다. 등록 결과 8행을 확인했다. 실행 SQL: supabase/maintenance/reconcile-history-20261026.sql. 이미 적용된 운영 정리용이며 새 DB 마이그레이션 목록에 넣지 않는다.
- statements는 NULL이며 원본 SQL은 저장소의 supabase/migrations가 기준이다. 향후 CLI를 연결한 뒤 migration list와 db push --dry-run으로 미적용 목록을 먼저 확인한다. 기존 파일을 다시 실행하거나 등록된 파일을 수정하지 않는다. 이번 검증은 SQL Editor로 수행했으며 CLI 실행 자체는 검증하지 않았다.
- StudyProvider는 Realtime 준비 완료/재연결 및 웹 online 시 즉시 재조회한다. 중지 실패 시 서버 승인까지 시간이 포함됨을 안내한다.
- LeaveProvider는 실패를 기억하고 다음 정상 공부 조회 시 재시도한다. 취소된 예약 타이머가 경계 갱신을 이미 처리했다고 표시하지 않도록 수정했다.
- 홈 → 공부 목표 설정(/goals), 요일별 현재/예약 목표, 하단 시간·쉬는 날·미설정 편집, 저장 중 중복 방지, 실패 시 입력 보존을 구현했다. 다음 공부 날짜 오전 6시부터 적용하며 저장 응답의 실제 적용 날짜를 안내한다. 재시도 시 최신 주간 설정을 조회해 선택한 요일만 병합한다. 분 단위 기존 값도 보존한다.
- 타입 검사·린트·웹 export·자동 테스트 44개 통과(Node 24 번들 런타임). 브라우저 모바일 390×844에서 화면/편집/범위 초과 거절을 확인했다. Android/iPhone 실기기 및 장애 주입 E2E는 미검증이다.
- 실제 DB의 기존 테스트 프로필로 다음 공부 날짜 적용, 현재 목표 보존, 45분/휴무/미설정 값 보존, 반복 저장 시 단일 예약 버전을 검증했다. 테스트 변경은 전체 롤백했다.

## Supabase CLI 연결 (2026-10-27)

- Homebrew Supabase CLI 2.122.0 및 libpq 18.6 설치 완료.
- 기존 프로젝트 `hxwwhgxxvyzqqnxlgqde` 연결 완료. CLI 인증은 사용자 로컬 설정에서 관리하며 저장소에 토큰을 넣지 않는다.
- `supabase/config.toml`은 CLI 초기화 설정이고 `.temp/`의 로컬 연결 메타데이터는 Git에서 제외한다.
- 연결 검증: CLI 읽기 전용 조회에서 DB `postgres`, 방 개수 `2`를 확인했다. 마이그레이션이나 앱 데이터는 이 연결 검증으로 변경하지 않았다.
- 일반 SQL 실행: `/opt/homebrew/bin/supabase db query --linked 'select current_database();'`
- SQL 파일 실행: `/opt/homebrew/bin/supabase db query --linked --file <파일경로>`
- `psql`은 `/opt/homebrew/opt/libpq/bin/psql`에 설치했다. 현재 SQL 실행은 별도 DB 비밀번호 없이 CLI의 Management API 연결을 사용한다.
- 기존 SQL Editor 반영분과 로컬 마이그레이션의 이력 정합성을 먼저 확인한 뒤 마이그레이션을 배포한다.

## Master production deployment routing (2026-10-27)

- Cloud Build handles every master push and freezes the triggering SHA. Lint, typecheck and tests must pass before deployment. Production CLI shortcuts dispatch this workflow on master rather than uploading a local checkout.
- A production plan validates the interactive review and compares the Android fingerprint, with only verified administrative normalization, to the newest published stable APK's candidate manifest. Draft/prerelease builds are excluded. Matching runtime, app version and build number select EAS Update; a changed runtime/version or absent runtime baseline selects the existing APK + web candidate flow. Documentation/test/server-only pushes skip mobile deployment.
- APK releases still require advancing app.json version/versionCode and package.json version. OTA deployments keep those values and do not create a GitHub Release. PR checks validate consistent version metadata; APK version advancement is enforced only on the APK route.
- New APK candidate.json files retain the actual EAS build runtime and build ID, verified against the production channel. For older manifests, the workflow recovers runtime/channel metadata from the verified release's archived EAS build result. If that APK has no compatible update runtime, a new APK release is required. Missing or malformed release assets stop deployment.
- Production planning and publishing use EAS production environment variables. Existing EXPO_TOKEN and public Supabase repository variables remain required. The update job uses the GitHub production environment, including any configured protection rules.
- Immediately before OTA publication, the workflow rechecks the latest master SHA, clean checkout, published APK baseline and runtime. Release promotion and deployment share one concurrency group. Native incompatibility never falls back to an OTA update.
- EAS messages contain the master SHA and commit subject. Actions summaries record route, commit, runtime, APK baseline, result, update group link and publication time. JSON plans, EAS responses, APK candidate metadata and per-job results are also appended to deployment-history under runs/<run-id>/attempt-<attempt>/ with no expiry. The dedicated branch is created automatically on its first archived master run. Existing entries are immutable; normal fast-forward pushes preserve concurrent records. Actions artifacts and console logs remain limited to 90 days; the repository log retention was verified as 90 days on 2026-10-27. EAS retains its publication history.
- Web candidate generation and release promotion remain on the APK release route. Android OTA does not promote the website or modify APK download/update notices. Server SQL is deployed separately.
- Local validation covers routing decisions, published baseline selection, EAS JSON shapes, master-only guards and workflow dependencies. Remote publication begins only after these changes are committed and merged into master; no OTA or APK deployment was triggered during implementation.

- The final history job runs even when preparation, APK building or OTA publication fails. It stores only allowlisted JSON files plus job conclusions and content checksums. Console logs, app bundles, APKs and environment files are not committed to the history branch. Credential-like JSON keys are redacted. History writes use an isolated Git index and never modify the master checkout; retries have separate attempt directories.
- Durable archive write failures fail the history job and remain visible in Actions; successful deployment is not rolled back if archiving fails. Re-running failed jobs retries archiving under the new run attempt. Repository retention settings govern console logs; per-artifact retention settings do not configure console logs.

### Interactive review gate and deployment PR labels

- Release PRs carry `.github/deployment-review.json`. Codex performs the review in the interactive PR-preparation session; there is no CI AI call or OpenAI API key. After committing the intended source, run `scripts/deployment.mjs review-context` with production app flags and GITHUB_REPOSITORY to obtain the source tree digest, published baseline, deterministic route, and verified exclusions. The skill supplies the rationale and evidence, then commits the report separately.
- Required report fields: `schema: 1`, `sourceCommit` (40-character Git SHA), `sourceTreeDigest` (SHA-256), `baseline` (`tag`, `sha`, `runtimeVersion`, or null before any APK release), `reviewer: {kind: "interactive-codex"}`, `recommendation` (update/apk/skip/needs-review), nonempty `rationale`, nonempty string-array `evidence`, string-array `exemptions`, and string-array `blockers`.
- Digest calculation covers every tracked path, mode and object except the report itself. It survives a report-only commit or a squash/merge with identical source content; source changes or a new APK baseline invalidate the review. No reviewer assertion overrides failed deterministic checks. Missing/stale/malformed reports, blockers and route disagreements stop app publication.
- Administrative normalization is deliberately narrow: only update:test/update:production script changes and additive known deployment-output ignore entries can be restored to their published-APK values during fingerprint calculation. Dependencies, build hooks, native/module/plugin inputs and other changes remain effective. The resulting complete fingerprint must equal the actual published APK runtime, not just another locally generated signature.
- On verified OTA publication only, private YUMYUM_OTA_RUNTIME/YUMYUM_OTA_SOURCE child-process variables select the existing APK runtime in app.config.js. Master/CI/source guards and a second compatibility check run before publication. EAS native builds reject the override and retain the fingerprint policy.
- `Deployment PR labels` reads PR JSON and Git tree data through GitHub APIs without checking out or running PR code in its pull_request_target job. It manages only deploy:eas-update, deploy:apk, deploy:skip and deploy:needs-review, preserving other labels. Labels show the reviewed candidate route; Check and production verification remain authoritative. This workflow becomes active after it is merged into master; the skill can label the initial PR using normal GitHub tools.
- Review JSON, validation outcome and native compatibility evidence are included in Actions artifacts and deployment-history alongside the deployment plan, including rejected reviews. Console log retention remains 90 days. No PR, merge, release or actual EAS publication was performed while implementing this connection.
