import type { CSSProperties } from 'react';
import type { SvgProps, PathProps, CircleProps } from 'react-native-svg';
import { StyleSheet } from 'react-native';

// Storybook renders the SVG primitives directly in the DOM. This avoids loading
// native modules and the package's CommonJS transform parser through Vite.
export default function Svg({ children, width, height, viewBox, style, pointerEvents }: SvgProps) {
  return <svg width={width} height={height} viewBox={viewBox} style={{ ...StyleSheet.flatten(style) as CSSProperties, pointerEvents: pointerEvents === 'none' ? 'none' : undefined }}>{children}</svg>;
}
export function Path({ d, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, opacity, transform }: PathProps) {
  return <path d={d} fill={fill as string} stroke={stroke as string} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} opacity={opacity} transform={typeof transform === 'string' ? transform : undefined} />;
}
export function Circle({ cx, cy, r, fill, stroke, strokeWidth, opacity }: CircleProps) {
  return <circle cx={cx} cy={cy} r={r} fill={fill as string} stroke={stroke as string} strokeWidth={strokeWidth} opacity={opacity} />;
}
