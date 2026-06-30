import type { BusinessPlanData, ExportHistoryItem } from '../types';

export interface UserData {
    plans: BusinessPlanData[];
    archivedPlans: BusinessPlanData[];
    logoStoragePath?: string; 
    poCounter: number;
    exportHistory: Omit<ExportHistoryItem, 'pdfDataUrl'>[];
}

const API_BASE = '/api';
const CURRENT_USER_ID = 'default_user_1'; // Simple mock user for single-user system

// Type alias to match Firebase User for App.tsx compatibility
export interface User {
  uid: string;
}

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
    // Our new backend returns the base64 string directly from the download URL
    // So we fetch it and return the data URI
    const res = await fetch(storagePath);
    if (!res.ok) throw new Error('Failed to download file');
    const data = await res.json();
    return data.data; // The base64 string
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
    const data = await res.json();
    return data;
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
      }
      setTimeout(poll, 5000); // Poll every 5 seconds
    };
    
    poll(); // Initial fetch
    
    return () => {
        isCancelled = true;
    };
};

export const subscribeToAuthChanges = (callback: (user: User | null) => void): (() => void) => {
    // Immediately log the user in as our default user
    setTimeout(() => {
        callback({ uid: CURRENT_USER_ID });
    }, 100);
    return () => {};
};

export const signInWithGoogle = async (): Promise<void> => {
    // No-op, already authenticated as default user
};

export const signOut = async (): Promise<void> => {
    // No-op
};
