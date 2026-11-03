# LodgeMobile Play Store release

The Android application ID is `com.lodgecore.management`.

## Signing

The release build intentionally refuses to use the debug signing key. Use a
Play App Signing upload key and keep both the keystore and `key.properties`
outside Git:

```sh
cp android/key.properties.example android/key.properties
# edit android/key.properties with the real upload key values
flutter build appbundle --release
```

The signed bundle will be generated at:

`build/app/outputs/bundle/release/app-release.aab`

## Encrypted signing backup

The repository contains only the encrypted backup
`PLAY_STORE_SIGNING_BACKUP.txt.enc`. The local plaintext backup remains
Git-ignored. Decrypt it only into a private location using the keystore
password:

```sh
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in PLAY_STORE_SIGNING_BACKUP.txt.enc \
  -out /private/tmp/lodgemobile-signing-backup.txt
```

Do not commit the decrypted output.

## Versioning

The current first release is `1.0.0` with Android version code `1`. Increment the
build number for every Play upload.

Before submission, complete the Play Console requirements for the app:

- store listing, app icon, screenshots, and support contact
- privacy policy URL and Data safety declaration
- content rating and target audience
- notification, biometric, and account-data disclosures as applicable
- internal testing track validation before production rollout
