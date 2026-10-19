# External scheduled jobs

Vercel Hobby supports the existing daily jobs, but the trial expiry job must
run hourly. Schedule it with an external service such as cron-job.org.

Create a job with:

- URL: `https://getlodgecore.vercel.app/api/v1/cron/expire-trials`
- Method: `GET`
- Schedule: every hour (`0 * * * *`)
- Header: `Authorization: Bearer <CRON_SECRET>`
- Expected success response: HTTP `200`

Set the same random value in the Vercel project environment variables:

```text
CRON_SECRET=<long-random-secret>
```

The endpoint is idempotent. It can be retried safely, and it only expires
subscriptions whose authoritative `trialEndsAt` has passed. Do not put the
secret in the URL query string because URLs may be logged by the scheduler or
intermediate systems.
