import { 
    GoogleAuthProvider, 
    setPersistence, 
    browserLocalPersistence, 
    signInWithPopup, 
    signOut as firebaseSignOut, 
    onAuthStateChanged,
    User as FirebaseUser
} from 'firebase/auth';
import { auth } from './firebaseConfig';
import type { BusinessPlanData, ExportHistoryItem } from '../types';

export interface UserData {
    plans: BusinessPlanData[];
    archivedPlans: BusinessPlanData[];
    logoStoragePath?: string; 
    poCounter: number;
    exportHistory: Omit<ExportHistoryItem, 'pdfDataUrl'>[];
}

const API_BASE = '/api';

// Type alias to match Firebase User for App.tsx compatibility
export type User = FirebaseUser;

export const uploadFileToStorage = async (uid: string, fileData: File | Blob, storagePath: string): Promise<string> => {
    // Convert Blob/File to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(fileData);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });

    const res = await fetch(`${API_BASE}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, base64Data })
    });
    
    if (!res.ok) throw new Error('Failed to upload file');
    const data = await res.json();
    return data.url; // Returns /api/files/download/:id
};

export const getDownloadURLFromStoragePath = async (storagePath: string): Promise<string> => {
    if (!storagePath) return '';
    
    // If it's a full URL, return it
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
        return storagePath;
    }

    // If it's not an API path (e.g. old Firebase path like 'users/...'), it's lost in the migration
    if (!storagePath.startsWith('/api/')) {
        console.warn(`[Storage] Old Firebase path detected and cannot be downloaded: ${storagePath}`);
        return '';
    }

    try {
        const res = await fetch(storagePath);
        if (!res.ok) throw new Error('Failed to download file');
        
        // Ensure we are receiving JSON and not the SPA fallback
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await res.json();
            return data.data; // The base64 string
        } else {
            console.error('[Storage] Received non-JSON response (likely SPA fallback)');
            return '';
        }
    } catch (e) {
        console.error('[Storage] Failed to fetch storage path:', e);
        return '';
    }
};

export const deleteFileFromStorage = async (storagePath: string): Promise<void> => {
    if (!storagePath) return;
    try {
        await fetch(storagePath, { method: 'DELETE' });
    } catch (e) {
        console.error("Error deleting file", e);
    }
};

export const saveUserData = async (uid: string, data: Partial<UserData>): Promise<void> => {
    const res = await fetch(`${API_BASE}/user/${uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to save user data');
};

export const getUserDataOnce = async (uid: string): Promise<UserData | null> => {
    const res = await fetch(`${API_BASE}/user/${uid}`);
    if (!res.ok) throw new Error('Failed to fetch user data');
    const text = await res.text();
    if (!text) return null;
    try {
        const data = JSON.parse(text);
        return data;
    } catch (e) {
        console.error("Failed to parse user data", e);
        return null;
    }
};

// We poll the backend for changes instead of using WebSockets for simplicity,
// or we can just fetch once and rely on App.tsx state. 
// For real-time updates across multiple tabs, polling is simple enough here.
export const onUserDataSnapshot = (uid: string, callback: (data: UserData | null) => void): (() => void) => {
    let isCancelled = false;
    
    const poll = async () => {
      if (isCancelled) return;
      try {
        const data = await getUserDataOnce(uid);
        callback(data);
      } catch (e) {
        console.error("Error polling user data", e);
        // Call callback with null so the UI doesn't hang in a loading state
        callback(null);
      }
      setTimeout(poll, 5000); // Poll every 5 seconds
    };
    
    poll(); // Initial fetch
    
    return () => {
        isCancelled = true;
    };
};

export const subscribeToAuthChanges = (callback: (user: User | null) => void): (() => void) => {
    return onAuthStateChanged(auth, callback);
};

export const signInWithGoogle = async (): Promise<void> => {
    const provider = new GoogleAuthProvider();
    console.log("[Auth] Attempting Google Sign-in via popup.");
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithPopup(auth, provider);
        console.log("[Auth] Google Sign-in popup successful.");
    } catch (error) {
        console.error("[Auth Error] Error signing in with Google:", error);
        throw error;
    }
};

export const signOut = (): Promise<void> => {
    console.log("[Auth] User signing out.");
    return firebaseSignOut(auth);
};
