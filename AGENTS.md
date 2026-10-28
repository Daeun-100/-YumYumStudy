This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Feature development workflow

- Create feature branches from the latest `develop` branch. Use the `codex/` prefix for branches created by Codex.
- Implement features on the feature branch and open a pull request targeting `develop`.
- Run lint and typecheck before opening the pull request. Production releases follow the existing `develop` → `master` release PR workflow in `docs/RELEASES.md`.

## Deployment versions

- Keep `app.json` (`expo.version`) and `package.json` versions identical, using `X.Y.Z`. This is the APK version shown to users; never append a revision suffix to app config.
- For a new production APK, increase Major for breaking changes, Minor for compatible features, or Patch for fixes, resetting lower positions. Increase Android `versionCode` too. APK releases use `vX.Y.Z`.
- For an update compatible with the published APK, keep the app version and `versionCode` unchanged. After a successful production update, automation creates a GitHub Release/tag `vX.Y.Z-rN` on the deployed commit, starting at `r1` for each APK version.
- Revision tags are deployment identifiers, not SemVer precedence. Never use them as an APK baseline or trigger APK download notices from them. Keep GitHub Latest pointing to the APK release.
- Use the existing master deployment workflow and compatibility review. Do not manually move tags, reuse revision numbers, or publish production updates directly from a local checkout. See `docs/RELEASES.md`.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
