/** Normalize native (boolean) and React Native Web (void) image loading results. */
export type ImageLoader = {
  prefetch(uri: string): Promise<boolean | void>;
  getSize(uri: string, success: (width: number, height: number) => void, failure: (error: unknown) => void): unknown;
};

export async function prepareImage(
  loader: ImageLoader,
  uri: string,
  expected: { width: number; height: number },
): Promise<void> {
  // Web resolves without a value on success; only an explicit false means failure.
  if (await loader.prefetch(uri) === false) throw Error('Image unavailable');
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    loader.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
  if (size.width !== expected.width || size.height !== expected.height) {
    throw Error('Image dimensions changed');
  }
}
