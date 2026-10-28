// 값을 바꾸고 저장한 뒤 로컬 웹에서 탭을 이동해 확인하세요.
export const TAB_ANIMATION = {
  durationMs: 100, // 전환 시간(ms): 작을수록 빠르게 전환
  distance: 14, // 좌우 이동 거리(React Native 레이아웃 단위)
  fade: true, // true: 페이드 혼합, false: 이동 효과만 사용
} as const;
