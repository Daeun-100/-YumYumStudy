import type { CSSProperties, ReactNode } from 'react';
import type { SvgProps, PathProps, CircleProps, ClipPathProps, PolygonProps, ImageProps } from 'react-native-svg';
import { Image as RNImage, StyleSheet } from 'react-native';

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
export function Defs({ children }: { children?: ReactNode }) { return <defs>{children}</defs>; }
export function ClipPath({ children, id }: ClipPathProps) { return <clipPath id={id}>{children}</clipPath>; }
export function Polygon({ points }: PolygonProps) { return <polygon points={typeof points === 'string' ? points : points?.join(' ')} />; }
export function Image({ href, width, height, preserveAspectRatio, clipPath }: ImageProps) {
  const source = Array.isArray(href) ? href[0] : href;
  const uri = typeof source === 'string' ? source : typeof source === 'object' ? source?.uri : source ? RNImage.resolveAssetSource?.(source)?.uri : undefined;
  return <image href={uri} width={width} height={height} preserveAspectRatio={preserveAspectRatio} clipPath={clipPath} />;
}
