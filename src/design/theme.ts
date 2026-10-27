import type { TextStyle } from 'react-native';

// 앱의 색상과 크기를 바꾸는 첫 번째 편집 지점입니다.
// 참고 이미지 기준: 밝은 배경 + 연두색 공부 상태 + 초록 강조 + 하늘색 연차.
// 모든 UI 표면은 불투명 단색입니다. 상태는 투명도가 아닌 색상으로 구분합니다.
export const colors = {
  background: '#FCFCF9', canvas: '#F6F6F2', surface: '#FFFFFF', navigation: '#FFFFFF',
  primary: '#108363', primaryPressed: '#096B50', surfacePressed: '#DDEFE2', disabledSurface: '#ECEDEA', disabledText: '#686C66', onPrimary: '#FFFFFF', text: '#252D28', secondary: '#66716F',
  border: '#EDF0EB', track: '#E8EDE7', soft: '#EDF8EE', raised: '#FFFFFF',
  study: '#C5E8CC', goal: '#FFA3A6', leaveIconBackground: '#CCE5FF', leaveBackground: '#EFF7FF', leave: '#226CB5',
  emptyBackground: '#F4F5F2', restBackground: '#F0F1EE', restStripe: '#D8DDD5',
  inactive: '#A6A59E', inactiveLabel: '#8C8F88', error: '#A24A37', resting: '#DBAE68',
  accent: '#E8A74F', onImage: '#FFFDF5', imageShadow: '#6F5339', artFallback: '#D5B28F',
};
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 28 };
export const radius = { card: 28, button: 30, panel: 40, pill: 999 };
export const layout = { maxWidth: 520, contentWidth: 480, pagePadding: spacing.xxl };
export const interaction = { minTouchSize: 44 };

// 용도별 글자 크기. fontFamily를 지정하지 않아 플랫폼 기본 글꼴과 접근성 확대를 유지합니다.
export const typography = {
  heading: { fontSize: 28, lineHeight: 39, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 25 },
  secondary: { fontSize: 14, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 20 },
  small: { fontSize: 11 },
  label: { fontSize: 12, fontWeight: '600' },
  button: { fontSize: 16, fontWeight: '700' },
  link: { fontSize: 14, fontWeight: '600' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  metric: { fontSize: 39, fontWeight: '700', letterSpacing: -1 },
  timer: { fontSize: 54, fontWeight: '700', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  control: { fontSize: 32, fontWeight: '700' },
  backIcon: { fontSize: 28 },
} satisfies Record<string, TextStyle>;

// 버튼/카드의 공통 외형. 화면에서는 색상·크기 대신 아래 변형을 사용합니다.
export const buttonTheme = {
  radius: radius.button, height: 54, horizontalPadding: spacing.xl,
  roundSize: 92, compactSize: interaction.minTouchSize,
};
export const cardTheme = {
  radius: radius.card, padding: spacing.xxl, compactPadding: spacing.xl,
  gap: spacing.md, borderWidth: 1,
};

// UI 테마와 별개인 기본 캐릭터 그림의 팔레트 (비트맵 일러스트에는 적용되지 않습니다).
export const avatarPalette = {
  fur: ['#FFF5EB', '#BF8A5D', '#F5E7D9', '#FFF9ED'],
  background: ['#E4EADF', '#F6DFC7', '#E3E9DB', '#F8E6DA'],
  shirt: '#7BA899', outline: '#B78365', face: '#503B30', blush: '#EFAF97',
};

// 전환 탭은 흰색 선택형, 목표 달성은 수박으로 통일합니다.
export const segmentedTheme = {
  background: colors.track, selectedBackground: '#FFFFFF',
  selectedText: colors.primary, text: colors.secondary, radius: 12,
};
export const achievementTheme = { iconSize: 28, compactIconSize: 20, label: '목표 달성', background: colors.soft, text: colors.primary };
