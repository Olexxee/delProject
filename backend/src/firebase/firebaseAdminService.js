import admin from "firebase-admin";
import configService from "../lib/classes/configClass.js";

const firebaseAdminConfig = {
  type: "service_account",
  project_id: configService.getOrThrow("FIREBASE_PROJECT_ID"),
  private_key_id: configService.getOrThrow("FIREBASE_PRIVATE_KEY_ID"),
  private_key: configService
    .getOrThrow("FIREBASE_PRIVATE_KEY")
    .replace(/\\n/g, "\n"),
  client_email: configService.getOrThrow("FIREBASE_CLIENT_EMAIL"),
  client_id: configService.getOrThrow("FIREBASE_CLIENT_ID"),
  auth_uri: configService.getOrThrow("FIREBASE_AUTH_URI"),
  token_uri: configService.getOrThrow("FIREBASE_TOKEN_URI"),
  auth_provider_x509_cert_url: configService.getOrThrow(
    "FIREBASE_AUTH_CERT_URL"
  ),
  client_x509_cert_url: configService.getOrThrow("FIREBASE_CLIENT_CERT_URL"),
  universe_domain: "googleapis.com",
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseAdminConfig),
    storageBucket: configService.getOrThrow("FIREBASE_STORAGE_BUCKET"),
  });
}

const firebaseStorage = admin.storage().bucket();
export const firebaseMessaging = admin.messaging();

export { admin, firebaseStorage };
