import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApp();
  }

  try {
    const serviceAccountPath = path.resolve(process.cwd(), 'firebase-adminsdk.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      return initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      console.warn('[Firebase Admin] Service account key not found at:', serviceAccountPath);
      console.warn('[Firebase Admin] Push notifications will be disabled.');
      return null;
    }
  } catch (error) {
    console.error('[Firebase Admin] Failed to initialize:', error);
    return null;
  }
}

export const firebaseAdmin = initializeFirebaseAdmin();

/**
 * Sends a push notification to a specific device token.
 */
export async function sendPushNotification(
  token: string, 
  title: string, 
  body: string, 
  data?: Record<string, string>
) {
  if (!firebaseAdmin) {
    console.warn('[Firebase Admin] Cannot send notification, admin not initialized.');
    return false;
  }

  try {
    const message = {
      notification: { title, body },
      data,
      token,
    };
    const response = await getMessaging(firebaseAdmin).send(message);
    console.log('[Firebase Admin] Successfully sent message:', response);
    return true;
  } catch (error) {
    console.error('[Firebase Admin] Error sending message:', error);
    return false;
  }
}
