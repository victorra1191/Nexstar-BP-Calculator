
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage'; // Import getStorage

// IMPORTANT: This configuration is for your specific Firebase project.
// It's a best practice NOT to commit API keys to a public GitHub repository.
// For Firebase Hosting, this configuration can often be injected automatically at deploy time.
// FIX: Export firebaseConfig so it can be imported by vite.config.ts
export const firebaseConfig = {
  apiKey: "AIzaSyBBPymwl4qc4KPUZRBD0dVaXQ5n6iDj48c", // NEW KEY
  authDomain: "gen-lang-client-0949923939.firebaseapp.com",
  projectId: "gen-lang-client-0949923939",
  storageBucket: "gen-lang-client-0949923939.appspot.com",
  messagingSenderId: "517665894104",
  appId: "1:517665894104:web:6f23cbba56d9dac932b1ad",
  measurementId: "G-V4RN5DFVCT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // Export storage instance