// Stub: firebase-admin is not used in the public booking website.
// Push notifications are handled by the PMS app (apps/web).

export async function sendPushNotification(
  _token: string,
  _title: string,
  _body: string,
  _data?: Record<string, string>
): Promise<void> {
  // no-op in website context
}
