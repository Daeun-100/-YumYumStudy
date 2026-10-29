---
name: yumyum-send-toast
description: 얌얌스터디 특정 방이나 사용자에게 앱 내부 토스트를 보내거나 삭제하고 표시 결과를 조회한다. 배포한 EAS 업데이트 안내 발송도 포함하며 OS 푸시 발송과 코드 구현 요청은 제외한다.
---

# 관리자 앱 내부 토스트

먼저 프로젝트의 [운영 안내](../../../docs/operations/ADMIN-TOASTS.md)를 읽는다. 실제 도구는 저장소 루트의 `scripts/admin-toasts.mjs`이고 서버는 `admin-toasts` 함수다. 서버 배포·비밀 설정이 준비되지 않았다면 발송 성공으로 보고하지 않는다.

- 사용자의 명시한 방·대상·안내 종류만 사용한다. 이미 구체적으로 지시한 발송을 불필요하게 재확인하지 않는다. 모호한 배포·방·동명이인은 조회로 해소하고 남은 모호성만 질문한다.
- 업데이트 안내는 고정 UI다. 문구를 묻거나 만들어 넣지 않는다. 성공한 해당 배포의 `update-record.json`, `eas-update.json`, `deployment-plan.json`을 대조한 preview를 사용한다. EAS group UUID와 플랫폼 update UUID를 혼동하지 않는다.
- 일반 안내는 사용자가 명시한 제목·본문만 사용한다. 임의 외부 링크·화면 이동·코드를 넣지 않는다.
- private 임시 JSON 파일로 preview하고 출력의 `prepared`를 보존해 create한다. 개인 UUID·토큰·본문을 셸 보간하거나 Git에 넣지 않는다. 기본 기간과 만료 시각은 운영 결과에 함께 알린다.
- 응답이 불명확하면 출력된 원래 requestId의 status부터 조회한다. 같은 입력·UUID로만 재시도한다. 새 UUID는 명시적으로 재발송할 때만 만든다.
- 삭제는 status에서 읽은 revision으로 delete한다. 서버에는 삭제 기록을 남기며 삭제한 안내는 복원할 수 없다. 다시 알리라는 명시적 요청은 새 요청·안내 UUID로 preview → create한다. 기존 UUID를 재사용하거나 비활성화·재활성화·resend API를 사용하지 않는다.
- 결과는 서버 저장·활성화와 앱 표시 보고를 구분한다. 오프라인·공부 중·이미 적용한 업데이트의 제외 조건을 유지한다. 실제 표시나 모든 사용자 도달을 단정하지 않는다.
- 자격 증명은 `~/.codex/skills/yumyum-send-toast/private/admin.json`의 mode 0600 파일에서 스크립트가 읽는다. 토큰이 없으면 운영 준비가 필요하다고 알리고 다른 관리자의 키를 재사용하지 않는다. 임시 입력·명단·결과 파일은 작업 후 삭제한다.
