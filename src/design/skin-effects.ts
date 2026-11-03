/** Coordinates are fractions of the full source canvas, including its margins. */
export type SkinEffectPlacement = { x: number; y: number; width: number; opacity: number };
export type SkinEffect = {
  kind: 'warmSteam';
  home: SkinEffectPlacement;
  focus: SkinEffectPlacement;
} | { kind: 'storyFragments' };
