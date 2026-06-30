import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCT4lmsFD5oNeZ0g2gEhqfHOQVk9cGsGzg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "bpnabo-be8c7.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "bpnabo-be8c7",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "bpnabo-be8c7.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "503388969805",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:503388969805:web:e677e48303827e76c77504"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);