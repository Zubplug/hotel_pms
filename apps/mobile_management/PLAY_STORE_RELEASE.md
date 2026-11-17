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

The current release is `1.0.4` with Android version code `5`. Increment the
build number for every Play upload.

## Release notes — 1.0.4 (Build 5)

- Added General Cashier expense recording with category, amount, payment method,
  notes, receipts, validation, and submission status.
- Added cash custody workflows for shift opening, handover, cash drops, deposits,
  reconciliation, and variance visibility.
- Added cashier shift review analysis with clearer totals, exceptions, and
  operational review context.
- Improved cashier dashboards, expense presentation, and navigation between
  custody, expenses, and shift review workflows.
- Improved finance-period reporting and aligned mobile API traffic with the
  current AWS production services.
- Improved offline cashier and audit workflow reliability and error handling.

Before submission, complete the Play Console requirements for the app:

- store listing, app icon, screenshots, and support contact
- privacy policy URL and Data safety declaration
- content rating and target audience
- notification, biometric, and account-data disclosures as applicable
- internal testing track validation before production rollout
