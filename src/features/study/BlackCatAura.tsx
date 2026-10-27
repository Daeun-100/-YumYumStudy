import Svg, { Path, Circle } from 'react-native-svg';
const blackCatContour = 'M370 850 L390 810 C285 772 220 704 220 575 C218 505 247 432 280 395 C252 350 236 292 241 242 C247 172 270 110 310 115 C360 120 430 180 490 240 C580 205 680 205 760 240 C825 170 900 110 945 115 C995 120 1015 240 1003 305 C997 347 987 376 970 395 C1009 460 1035 514 1030 575 C1035 700 970 773 860 810 L880 850';
export function BlackCatAura({ size, opacity }: { size: number; opacity: number }) {
  return <Svg pointerEvents="none" width={size} height={size} viewBox="0 0 1254 1254" style={{ position: 'absolute', opacity }}>
    {[{ width: 220, color: '#FFCB45', opacity: .14 }, { width: 116, color: '#FFD453', opacity: .26 }, { width: 92, color: '#FFDC68', opacity: .55 }, { width: 70, color: '#FFE588', opacity: .95 }, { width: 22, color: '#FFF5C0', opacity: 1 }].map(band => <Path key={band.width} d={blackCatContour} transform="translate(-25 -20) scale(1.04)" fill="none" stroke={band.color} strokeWidth={band.width} opacity={band.opacity} strokeLinecap="round" strokeLinejoin="round" />)}
    {[[627, 155, 31], [1055, 640, 23], [245, 145, 38], [1008, 150, 34], [175, 470, 30], [1085, 480, 40], [248, 745, 26], [1015, 750, 28]].map(([x, y, r]) => <Path key={`${x}-${y}`} d={`M${x} ${y-r} Q${x+3} ${y-3} ${x+r} ${y} Q${x+3} ${y+3} ${x} ${y+r} Q${x-3} ${y+3} ${x-r} ${y} Q${x-3} ${y-3} ${x} ${y-r}Z`} fill="#FFFDEB" stroke="#FFE28A" strokeWidth={2} />)}
    <Circle cx={1020} cy={345} r={4} fill="#FFFDEB" stroke="#FFE28A" strokeWidth={2} />
  </Svg>;
}
