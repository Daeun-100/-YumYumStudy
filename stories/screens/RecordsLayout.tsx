import { Text, View } from 'react-native';
import { colors, spacing, typography } from '../../src/design/theme';
import { RecordsPreview, type RecordsPreviewProps } from '../../src/features/records/RecordsPreview';
import { BottomTabs } from './StudyLayouts';
export function RecordsLayout({ width = 390, height = 844, ...props }: RecordsPreviewProps & { width?: number; height?: number }) {
  return <View style={{ width, maxWidth: '100%', height, borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}><View style={{ height: 44, paddingHorizontal: spacing.xxxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={[typography.label, { color: colors.text }]}>9:41</Text><Text style={{ color: colors.text }}>● ● ▰</Text></View><RecordsPreview {...props} /><BottomTabs selected="기록" onSelect={() => {}} /></View>;
}
