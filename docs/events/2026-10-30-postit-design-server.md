# 포스트잇 서버 적용과 할로윈 PNG 업로드

- 확인 시각: 2026-10-30 16:13 KST.
- 사용자 요청: PR #53의 포스트잇 서버 기능 적용과 최종 배경·미리보기 PNG 업로드.
- 대상: 공유 Supabase 프로젝트 `hxwwhgxxvyzqqnxlgqde`.
- 상태: 마이그레이션 적용, PNG 2개 업로드·공개 다운로드 검증, 라이브러리 등록 완료.
- 디자인은 비활성(`grant_enabled=false`)으로 등록했다. 행사 예약·사용자 지급·앱 배포는 수행하지 않았다.

## 서버 적용

`20261029162732_postit_design_rewards`를 적용했다. 연결된 Supabase 도구가 생성한 시각 이력은 공식 CLI의 migration repair로 원본 파일 버전에 정합화했으며, 서버 이력은 위 버전 한 건으로 확인했다. SQL을 중복 실행하거나 적용한 테이블을 되돌리지 않았다.

보유 디자인·표현 보존·지급 규칙·처리 이력용 private 테이블 5개와 `room_postits`의 디자인 참조, 사용자 및 관리자 RPC를 추가했다. 기존 포스트잇 42건·보유 스킨 16건·이벤트 2건·예약 이력 6건을 보존했다. 이미지 라이브러리는 기존 6건에서 7건으로 늘었다.

## 이미지와 등록

- 디자인 ID: `halloween-ghost`, 이름: 할로윈 유령 포스트잇.
- 버킷: `event-artwork`, 주제: `halloween`, schemaVersion 2.
- 두 이미지 모두 1254×1254, 파일당 2 MiB 이하. 최종 미리보기는 불투명하며 앱에서 확대 없이 원형으로 잘라 표시한다.
- 빈 경로를 확인한 뒤 공식 Storage CLI로 새 파일을 업로드했다. 기존 파일을 덮어쓰지 않았다.
- 무인증 공개 다운로드의 바이트 크기·SHA-256과 PNG 서명·CRC·압축 데이터·규격·미리보기 투명도를 재검증했다.
- `admin_register_artwork(...,false)`로 등록하고 저장된 정의·경로·해시·비활성 상태를 다시 조회했다.

| 구분 | 경로 | 바이트 | SHA-256 |
| --- | --- | --- | --- |
| 종이 | `halloween/postits/halloween-ghost/paper-square.png` | 1846205 | `a831c94915e7640266095be03dcf1c9dce0652681d58831e866581bdeb1dbdf6` |
| 미리보기 | `halloween/postits/halloween-ghost/preview-fullbleed.png` | 2080880 | `c55cdbaab4e1a476145a5a5e8e14664bf9606b16c481e9fe4963077325206ca5` |

## 권한과 동작 검증

- 실제 입장 완료 사용자에 대해 트랜잭션 안에서 authenticated 역할의 `sync_postit_designs` 응답을 확인했다. 다른 방 조회는 거부됐으며 검증 트랜잭션은 롤백했다.
- 새 private 테이블 5개는 RLS가 켜져 있고 anon·authenticated 직접 SELECT가 불가능하다.
- 사용자용 공개 RPC는 SECURITY INVOKER이고 authenticated만 실행할 수 있다. 새 관리자 RPC는 service_role만 실행할 수 있다.
- 보안 Advisor의 기존 WARN 집계는 유지됐다. 새 private 테이블의 의도적인 직접 접근 차단 때문에 [RLS Enabled No Policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) INFO가 5개 추가됐다. RPC 외 직접 접근을 열기 위한 정책은 추가하지 않았다.
- 최종 조회: 보상 규칙 0건, 사용자 보유 0건, 처리 이력 0건. 실제 자동 지급은 검증하지 않았다.

## 남은 운영 단계

지원 앱을 기존 릴리스 절차로 배포하고 실제 기기에서 확인해야 한다. 앱의 북마크 노출 기간은 한국시간 2026-10-31 06:00부터 2026-11-01 06:00 직전까지다. 자동 보상을 운영하려면 별도 요청으로 대상 방을 확정하고 같은 기간·1800초·`halloween-ghost`의 보상 규칙을 등록하고 지급을 활성화해야 한다. 이번 서버 준비와 이미지 등록만으로 행사가 예약되지는 않는다.
