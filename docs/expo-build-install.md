# Expo build and phone install steps

Use this when you want to build an installable version of the app for your phone.

## Run the app in Expo Go for development

From the project root:

```bash
npm start
```

Then scan the QR code with Expo Go.

If the phone cannot connect on the same Wi-Fi, use tunnel mode:

```bash
npx expo start --tunnel
```

## Build an installable Android app

This project uses EAS Build. The `preview` profile in `eas.json` is configured for internal distribution:

```json
"preview": {
  "distribution": "internal"
}
```

Run this command:

```bash
npx eas-cli build --platform android --profile preview
```

Important: use `eas-cli`, not `eas`.

Wrong:

```bash
npx eas build --platform android --profile preview
```

Right:

```bash
npx eas-cli build --platform android --profile preview
```

The wrong command may fail with:

```txt
npm error could not determine executable to run
pkgid eas@0.1.0
```

That happens because `npx eas` downloads the wrong npm package. The Expo build tool is `eas-cli`.

## Login if EAS asks

If you are not logged in:

```bash
npx eas-cli login
```

Then run the build again:

```bash
npx eas-cli build --platform android --profile preview
```

## Optional: install EAS CLI globally

If you do not want to type `npx eas-cli` every time:

```bash
npm install -g eas-cli
```

Then you can use:

```bash
eas build --platform android --profile preview
```

## Build for iPhone

For iOS internal builds:

```bash
npx eas-cli build --platform ios --profile preview
```

Note: iOS builds require Apple Developer credentials and device registration. Android internal builds are usually simpler.

## Build both Android and iOS

```bash
npx eas-cli build --platform all --profile preview
```

## After the Android build finishes

EAS will print a build link and usually a QR code. Open that link on your Android phone and install the app.

## Quick checklist before building

Run these first:

```bash
npm run typecheck
npm test
```

Then build:

```bash
npx eas-cli build --platform android --profile preview
```
