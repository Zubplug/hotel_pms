# Booking hold expiry scheduler

The Vercel Hobby deployment keeps a daily fallback cron, but production hold
expiry should be invoked externally every two minutes.

Configure an external HTTP scheduler (for example, QStash, cron-job.org, or
EasyCron) with:

```text
Method: POST
URL: https://<website-production-domain>/api/v1/cron/expire-booking-holds
Schedule: */2 * * * *
Header: Authorization: Bearer <CRON_SECRET>
```

Set the same `CRON_SECRET` value in the website's Vercel Production
environment. The endpoint is idempotent: each run only transitions expired
`ACTIVE` holds to `EXPIRED`.
