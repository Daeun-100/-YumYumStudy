declare module '*.png' {
  // Metro returns a resource ID; Storybook/Vite returns an asset URL.
  const source: number | string;
  export default source;
}
