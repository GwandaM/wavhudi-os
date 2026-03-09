# Distribution Signing and Notarization

This repo is configured to require code signing for packaged Electron builds.

Relevant project files:

- `electron-builder.yml`
- `build/entitlements.mac.plist`
- `package.json`

Current packaged targets:

- macOS: `dmg`
- Windows: `nsis`
- Linux: `AppImage`

Current packaging command:

```bash
npm run electron:build
```

## What this means

- macOS builds must be signed and notarized before distribution.
- Windows builds should be signed to avoid SmartScreen and IT blocking issues.
- Signing secrets should live in CI or in a secure local keychain, not in the repo.

## macOS Checklist

### 1. Apple account requirements

- Enroll in the Apple Developer Program.
- Use a team that can create Developer ID certificates.
- Confirm the Apple team has permission to notarize apps.

### 2. Certificates you need

For this repo's `dmg` target, the required certificate is:

- `Developer ID Application`

You do not need `Developer ID Installer` unless you add a `pkg` target later.

### 3. Create and export the certificate

On a Mac with access to the Apple Developer team:

- Create or download the `Developer ID Application` certificate.
- Export it from Keychain Access as a `.p12` file.
- Protect it with a strong password.

### 4. Put signing material into secrets

Electron Builder supports these environment variables:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`

Recommended CI pattern:

- base64-encode the `.p12`
- store the base64 value as `CSC_LINK`
- store the export password as `CSC_KEY_PASSWORD`

Alternative on a developer Mac:

- import the certificate into the login keychain
- let Electron Builder discover it automatically
- optionally set `CSC_NAME` if there are multiple matching identities

### 5. Configure notarization credentials

Electron Builder can notarize automatically if one of these credential sets is present:

- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- `APPLE_KEYCHAIN`, `APPLE_KEYCHAIN_PROFILE`

Use the App Store Connect API key path if possible. It is the recommended option.

### 6. Build and notarize

Run on macOS:

```bash
npm install
npm run electron:build
```

Expected result:

- app is signed
- DMG is produced in `release/`
- notarization is submitted automatically
- notarization ticket is stapled to the final artifact

### 7. Validate the shipped artifact

Check the signature:

```bash
codesign --verify --deep --strict --verbose=2 "release/Wavhudi OS-*.dmg"
```

Check Gatekeeper assessment:

```bash
spctl -a -vv "release/Wavhudi OS-*.dmg"
```

If you need to verify the app bundle inside the DMG after mounting it:

```bash
codesign --verify --deep --strict --verbose=2 "/Volumes/Wavhudi OS/Wavhudi OS.app"
spctl -a -vv "/Volumes/Wavhudi OS/Wavhudi OS.app"
```

## Windows Checklist

### 1. Decide which signing path to use

Use one of these:

- Standard code-signing certificate from a trusted CA
- EV code-signing certificate
- Microsoft Artifact Signing / Trusted Signing if your organization is eligible

For the least friction with IT and Windows reputation systems:

- prefer a trusted public code-signing certificate
- ensure it is RSA-based, not ECC-only

### 2. Certificate requirements

Your certificate must be valid for code signing and include the private key.

For file-based signing with Electron Builder, export it as:

- `.pfx`

### 3. Put Windows signing material into secrets

Electron Builder supports:

- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`

If you use one certificate for both macOS and Windows in different jobs, you can also use:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`

But separate Windows-specific variables are cleaner when CI builds multiple platforms.

### 4. Build the installer

Run on Windows for the most predictable result:

```powershell
npm install
npm run electron:build
```

Expected result:

- signed app binaries
- signed NSIS installer in `release/`

### 5. Validate the shipped artifact

Verify the installer signature:

```powershell
signtool verify /pa /v "release\\*.exe"
```

If SignTool is not in `PATH`, it is typically installed with the Windows SDK.

### 6. Smart App Control and work-managed devices

To reduce IT friction:

- use a certificate from a trusted provider
- ensure the certificate uses RSA
- sign all shipped Windows binaries, not just the top-level installer
- keep the publisher name stable across releases

## CI Secrets Checklist

Do not commit any of these values:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

Store them in:

- GitHub Actions secrets
- your CI provider's secure secret store
- or the local OS credential store for manual builds

## Repo-Specific Notes

- `electron-builder.yml` already has `forceCodeSigning: true`, so packaging will fail until signing is configured.
- macOS hardened runtime and entitlements are already enabled.
- This repo currently builds a DMG, not a PKG.
- The current build machine should use Node `20.19+` or `22.12+` for cleaner Electron tooling compatibility.

## Minimum handoff to IT or ops

Give them this list:

- Apple Developer team access
- a `Developer ID Application` certificate for macOS
- notarization credentials using App Store Connect API keys
- a Windows public code-signing certificate or Artifact Signing setup
- CI secret storage for the certificate material and passwords
- one macOS machine for notarized release validation
- one Windows machine with Smart App Control or equivalent policy enabled for release validation

## Completion criteria

You are done when all of the following are true:

- `npm run electron:build` succeeds on macOS with signing enabled
- macOS artifact passes `codesign` and `spctl`
- `npm run electron:build` succeeds on Windows with signing enabled
- Windows artifact passes `signtool verify`
- a clean work-managed Mac opens the app without Gatekeeper blocks
- a clean work-managed Windows machine installs the app without signature blocks
