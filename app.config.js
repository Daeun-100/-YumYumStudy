const base = require('./app.json').expo;
module.exports = () => {
  const variant = process.env.APP_VARIANT || process.env.EXPO_PUBLIC_APP_VARIANT || 'production';
  if (!['test', 'production'].includes(variant)) throw new Error('Unknown APP_VARIANT');
  if (process.env.EXPO_PUBLIC_APP_VARIANT && process.env.EXPO_PUBLIC_APP_VARIANT !== variant) throw new Error('App variant mismatch');
  const test = variant === 'test';
  // Set only by the verified OTA publisher; native builds keep fingerprint policy.
  const otaRuntime = process.env.YUMYUM_OTA_RUNTIME;
  if (otaRuntime && (test || process.env.GITHUB_ACTIONS !== 'true'
    || process.env.GITHUB_REF !== 'refs/heads/master' || process.env.EAS_BUILD === 'true'
    || !/^[a-f0-9]{40,64}$/i.test(otaRuntime)
    || process.env.YUMYUM_OTA_SOURCE !== process.env.GITHUB_SHA
    || !/^[a-f0-9]{40}$/.test(process.env.YUMYUM_OTA_SOURCE ?? ''))) {
    throw new Error('OTA runtime override requires a verified production master publish');
  }
  return {
    ...base,
    runtimeVersion: otaRuntime || { policy: 'fingerprint' },
    updates: {
      url: `https://u.expo.dev/${base.extra.eas.projectId}`,
      requestHeaders: { 'expo-channel-name': variant },
    },
    plugins: [...base.plugins, ['expo-secure-store', { configureAndroidBackup: true }]],
    name: test ? '얌얌스터디 테스트' : base.name,
    scheme: test ? 'yumyumstudy-test' : base.scheme,
    android: { ...base.android, googleServicesFile: './config/firebase/google-services.json', package: test ? `${base.android.package}.test` : base.android.package },
    web: { ...base.web, output: 'single' },
    extra: { ...base.extra, appVariant: variant },
  };
};
