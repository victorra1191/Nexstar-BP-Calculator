import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// IMPORTANT: This configuration is for your specific Firebase project.
// It's a best practice NOT to commit API keys to a public GitHub repository.
// For Firebase Hosting, this configuration can often be injected automatically at deploy time.
const firebaseConfig = {
  apiKey: "AIzaSyACFbjUV1rG0UnB1n1h0UbHdabtS5xdqZ0",
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
