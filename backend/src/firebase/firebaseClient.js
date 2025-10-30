import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import configService from "../lib/classes/configClass.js";

const firebaseConfig = {
  apiKey: configService.getOrThrow("FIREBASE_API_KEY"),
  authDomain: configService.getOrThrow("FIREBASE_AUTH_DOMAIN"),
  projectId: configService.getOrThrow("FIREBASE_PROJECT_ID"),
  storageBucket: configService.getOrThrow("FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: configService.getOrThrow("FIREBASE_MESSAGING_SENDER_ID"),
  appId: configService.getOrThrow("FIREBASE_APP_ID"),
  measurementId: configService.get("FIREBASE_MEASUREMENT_ID"),
};

const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const firebaseStorage = getStorage(firebaseApp);

export { firebaseApp, firebaseAuth, firebaseStorage };
