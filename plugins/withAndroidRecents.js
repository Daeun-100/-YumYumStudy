const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

// S25 system log: startActivityFromRecents passes an existing rooted task to
// ActivityStarter, which rejects singleTask with "has root ... but target is
// singleInstance/Task". singleTop avoids that guard and reuses the top activity.
// Keep this in CNG configuration so every native build receives the workaround.
module.exports = function withAndroidRecents(config) {
  return withAndroidManifest(config, config => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    activity.$['android:launchMode'] = 'singleTop';
    return config;
  });
};
