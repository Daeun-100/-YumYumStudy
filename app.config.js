const base = require('./app.json').expo;
module.exports = () => {
  const variant = process.env.APP_VARIANT || process.env.EXPO_PUBLIC_APP_VARIANT || 'production';
  if (!['test', 'production'].includes(variant)) throw new Error('Unknown APP_VARIANT');
  if (process.env.EXPO_PUBLIC_APP_VARIANT && process.env.EXPO_PUBLIC_APP_VARIANT !== variant) throw new Error('App variant mismatch');
  const test = variant === 'test';
  return {
    ...base,
    name: test ? '얌얌스터디 테스트' : base.name,
    scheme: test ? 'yumyumstudy-test' : base.scheme,
    android: { ...base.android, package: test ? `${base.android.package}.test` : base.android.package },
    web: { ...base.web, output: 'single' },
    extra: { ...base.extra, appVariant: variant },
  };
};
