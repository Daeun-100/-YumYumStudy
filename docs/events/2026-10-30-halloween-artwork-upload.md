# 할로윈 스킨 에셋 업로드

- 확인일: 2026-10-30 한국 시간.
- 사용자 요청: 각 캐릭터별 할로윈 스킨을 주제별 서버 폴더에 올린다.
- 상태: 제공된 4종의 홈·집중 PNG 8개 업로드·검증·라이브러리 등록 완료.
- 등록만 수행했다. 지급 가능 활성화·실제 지급·착용 변경·이벤트 예약·푸시 발송은 하지 않았다.

## 파일과 검증

| 스킨 ID | 캐릭터 | 홈 경로 | 집중 경로 |
| --- | --- | --- | --- |
| `bunny-halloween` | `bunny` | `halloween/skins/bunny/home.png` | `halloween/skins/bunny/focus.png` |
| `blackcat-halloween` | `blackcat` | `halloween/skins/blackcat/home.png` | `halloween/skins/blackcat/focus.png` |
| `maltese-halloween` | `maltese` | `halloween/skins/maltese/home.png` | `halloween/skins/maltese/focus.png` |
| `pomeranian-halloween` | `pomeranian` | `halloween/skins/pomeranian/home.png` | `halloween/skins/pomeranian/focus.png` |

- 버킷: `event-artwork`, 주제: `halloween`, 정의 형식: schemaVersion 2.
- PNG 서명·CRC·압축 데이터·투명도·규격·파일 크기를 검사했다. 홈 1536×1024, 집중 1254×1254, 파일당 5 MiB 미만이다.
- 실제 공개 다운로드 8개의 바이트 크기·SHA-256이 원본과 일치했다.
- 기존 파일을 덮어쓰지 않고 새 경로에 등록했다. `admin_register_artwork(...,false)`로 저장하고 기존 보유 16건을 유지했다.
- 새 스킨 보유자는 0명이며 등록된 4종은 지급 전 상태다.
- 곰·고양이·강아지의 할로윈 PNG는 제공되지 않아 생성·대체 업로드하지 않았다.
- 포메라니안은 제공된 pumpkin 홈 / focus-halloween-pumpkin-v2 파일을 사용했다. 파일명의 v2는 원본 이름이며 서버에 이미지 버전 UUID를 만들지 않았다.

## 해시

- `halloween/skins/bunny/home.png`: `e8e16c31cbc5c8b2613a86c8499c6f4f0d9e926b148039123360217dafb13e87` (507197 bytes)
- `halloween/skins/bunny/focus.png`: `4864e58cb168a51557d12736ef6d53cb338867269848e76c0bd689432929c371` (917654 bytes)
- `halloween/skins/blackcat/home.png`: `2e06fc7a4874566552ad141b19b20b3108cb0bc9f39512ec93069afc0e13cdbb` (1195442 bytes)
- `halloween/skins/blackcat/focus.png`: `5b816268c81947faeb3016fc8422dec93b90cbccb75c449d790f3fe335b15587` (883221 bytes)
- `halloween/skins/maltese/home.png`: `86ad6fc3cebacb74d276bda45e980da728b23176b5ac0a35b3c682157c991be9` (945467 bytes)
- `halloween/skins/maltese/focus.png`: `08adbb4a87009eed89cfb3e5d76fcb6987212442104315681d025c9465775d1c` (1090903 bytes)
- `halloween/skins/pomeranian/home.png`: `5b4e37b9ba6110a817118bd4fe8070df3e910baa03a880cb18f1c948de41c0ac` (1231616 bytes)
- `halloween/skins/pomeranian/focus.png`: `f2aaa5647d5e886af7a1983d8503e87130ee573d21107bffc55c6f682268a070` (989101 bytes)

실제 기기 착용·배치는 아직 확인하지 않았다. 등록된 원격 스킨은 새 앱 지원 코드와 지급 이후 사용자 선택으로 표시한다.
