# 관리자 연차

## 정책

관리자용 DB 접속(SQL Editor의 postgres 역할)으로 특정 사용자·공부 날짜에 연차를 지급과 동시에 적용한다. 앱의 관리자 화면이나 관리자 계정 판별 기능은 추가하지 않는다.

- 종류는 기존 `leave_grants.kind`에 `admin`을 추가한다. 새 테이블 없이 연차 테이블 2개를 유지한다.
- 추가 컬럼은 선택 입력인 `reason text` 하나다. 사유는 운영 메모이며 앱 RPC와 일반 사용자의 직접 테이블 조회에 공개하지 않는다.
- 과거·오늘·미래 날짜와 주별 지급 개수 제한이 없다. 적용 날짜는 필수다.
- 한국시간 오전 6시부터 다음 날 오전 6시까지가 하나의 공부 날짜다.
- `earning_week`, `expires_at`은 NULL이다. 만료가 없으며 사용 가능 잔액·만료 예정 수량·자동 차감에 포함하지 않는다.
- `earned_at`, `recorded_at`, `approved_at`은 실제 처리 시각이다. 과거 적용 때문에 과거로 조작하지 않는다.
- 사용자·날짜별 연차 1개 제한은 그대로 유지한다. 무료·보상·관리자 연차가 이미 있는 날짜는 교체하거나 덮어쓰지 않는다.
- 무료·보상 연차의 주별 중복 방지, 획득 주, 만료 정책은 유지한다.
- 앱에서는 관리자 연차를 변경·취소할 수 없다. 서버도 같은 요청을 거부한다.
- 관리자 연차일은 보상 인정 일수에서 제외한다. 실제 공부 시간·목표 달성·진행 중 타이머는 유지한다.
- 과거 적용으로 인정 일수가 부족해져도 이미 지급한 보상은 유지한다. 미지급 보상은 적용 후 기록으로 계산한다.

## 앱 표시

`SCHEDULED`는 예약, `USED`는 적용일 오전 6시 이후의 상태다. 기존 상태 계산은 적용 날짜를 먼저 확인하므로 관리자 연차에 별도 만료 상태를 만들지 않는다. 메인 일정에서는 오늘을 '사용 중'으로 표시하며 과거 내역은 달력에서 확인한다.

날짜 상세에는 '관리자 지급'과 다음 문장만 표시한다. 변경·취소 버튼, 운영 사유와 만료일은 표시하지 않는다.

> 관리자가 적용한 연차예요. 변경이 필요하면 관리자에게 문의해 주세요.

스토리북: `화면 시안/관리자 연차`의 메인·미래·오늘·과거·일반 예약 비교·320px 화면. 실제 앱과 같은 디코더·표시 변환·뷰를 사용한다.

앱 복귀 또는 당겨서 새로고침을 통해 연차를 다시 조회한다. 서버 `leave_revision` 변경을 감지하면 기록 캐시를 무효화하고 공부 현황을 갱신한다. 외부 SQL 지급을 즉시 전달하는 별도 연차 실시간 구독이나 알림 발송은 추가하지 않는다.

## 지급

먼저 대상 UID와 기존 날짜 적용 내역을 확인한다. 동명이인은 UID로 구분한다.

```sql
select id, display_name, room_id from public.profiles order by display_name, id;

select id, kind, scheduled_date, reason, recorded_at
from public.leave_grants
where user_id = 'USER_UUID'::uuid
order by scheduled_date desc nulls last;
```

요청 한 건에 UUID를 하나 발급하여 기록하고, 결과가 불확실할 때 **동일한 UUID와 입력으로 재시도**한다. `GRANT_UUID`, `USER_UUID`, 날짜와 사유는 실제 값으로 바꾼다. UUID 생성은 `select gen_random_uuid();`를 사용한다.

```sql
select public.admin_apply_leave(
  p_id     => 'GRANT_UUID'::uuid,
  p_uid    => 'USER_UUID'::uuid,
  p_date   => date '2026-10-21',
  p_reason => '관리자 요청으로 소급 적용'
);
```

사유가 없으면 `p_reason => null` 또는 인자 생략이 가능하다. 함수는 적용 건 ID를 반환한다.

- 같은 UUID·같은 입력: 원래 요청의 ID를 반환하며 중복 지급하거나 처리 시각을 덮어쓰지 않는다.
- 같은 UUID·다른 입력: 오류.
- 다른 UUID·이미 연차가 있는 날짜: 오류.
- 없는 사용자, 날짜 누락 또는 무한 날짜: 오류.
- 관리자 전용 SQL 함수는 SECURITY INVOKER이며 `PUBLIC`, `anon`, `authenticated`, `service_role`에 실행 권한을 부여하지 않는다. 비밀 키를 앱에 추가하지 않는다.

지급 요청 식별자는 기존 비공개 `leave_requests`에 저장한다. 관리자가 이후 날짜를 변경하거나 적용을 삭제해도 옛 지급 요청의 재전송으로 복구되지 않는다. 재지급은 새로운 UUID로 수행한다.

## 관리자 날짜·사유 수정

앱에서는 수행하지 않는다. SQL에서도 **사용자 프로필을 먼저 잠근 뒤** 수정하여 앱의 연차 요청과 같은 잠금 순서를 지킨다. 대상은 반드시 `kind='admin'`으로 제한한다.

```sql
begin;
select id from public.profiles where id='USER_UUID'::uuid for update;

update public.leave_grants
set scheduled_date=date '2026-10-22',
    reason='적용일 정정',
    approved_at=clock_timestamp()
where id='GRANT_UUID'::uuid and user_id='USER_UUID'::uuid and kind='admin'
returning id, scheduled_date, reason, recorded_at, approved_at;
commit;
```

처리 전후 결과를 확인한다. 이미 연차가 있는 날짜로 변경하면 기존 날짜별 UNIQUE 제약이 거부한다. 사용자·ID·종류 자체는 변경하지 않는다. 원래 지급·기록 시각은 보존한다.

## 관리자 적용 취소

취소는 관리자 연차 행을 삭제한다. 미사용 관리자 연차로 돌려놓지 않는다.

```sql
begin;
select id from public.profiles where id='USER_UUID'::uuid for update;

delete from public.leave_grants
where id='GRANT_UUID'::uuid and user_id='USER_UUID'::uuid and kind='admin'
returning id, scheduled_date;
commit;
```

프로필 `leave_revision`은 관리자 연차 INSERT·UPDATE·DELETE 트리거가 자동 증가시킨다. 별도로 증가시키지 않는다. 무료·보상 데이터는 이 트리거로 변경하지 않는다.

삭제 후 출석은 실제 공부 기록 기준으로 복원된다. 해당 주의 미지급 보상 자격이 복구되면 다음 연차 조회에서 보상이 지급될 수 있다.

최초 지급 요청은 중복 방지용으로 남지만, 날짜·사유의 전체 변경 이력을 보존하는 감사 테이블은 없다. 관리자 수정·취소 전후 내역은 필요한 경우 별도로 보관한다.

## 적용 및 검증

- 원격 적용: `20261028114338_admin_leave` (2026-10-28). 같은 버전의 로컬 SQL 파일과 원격 migration history를 맞췄다. 중복 실행하지 않는다.
- 실제 사용자에게 관리자 연차는 지급하지 않았다.
- 새 앱 코드 배포 전에는 관리자 연차를 실제 지급하지 않는다. 이전 앱 디코더는 `admin`과 NULL 만료일을 지원하지 않아 연차 조회가 실패할 수 있다. 앱 배포는 기존 master 배포 절차를 따른다.
- `supabase/tests/admin_leave.sql`: 실제 DB에서 과거·오늘·미래 적용, 주간 여러 건, 재시도·취소 후 재전송, 중복 날짜, 상태 경계, 사유 접근 권한, RLS, 사용자 변경·취소 차단, 공부 기록·보상 보존, 취소 후 자격 복구를 검증한다. 표시된 테스트 계정만 사용하고 모두 롤백한다.
- 기존 당일 사용·요청·예약 변경·출석·주간 무료 지급 SQL 5종 회귀 검사 통과. 기존 테스트의 가입 완료 상태 및 주간 무료 지급의 전역 빈 테이블 가정은 롤백 트랜잭션 안에서 테스트 계정을 격리하여 실행했다.
- 앱 자동 테스트 203개, 린트, 타입 검사, 웹 export 통과.
- Supabase 보안 advisor에 관리자 함수 관련 신규 경고가 없음을 확인했다. 기존 경고는 이번 변경에서 수정하지 않았다.
- 실제 두 DB 연결을 이용한 동시 요청 경합과 휴대폰 실기기 검증은 수행하지 않았다.
