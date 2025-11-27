import { 
    GoogleAuthProvider, 
    setPersistence, 
    browserLocalPersistence, 
    signInWithPopup, 
    signOut as firebaseSignOut, 
    onAuthStateChanged,
    User
} from 'firebase/auth';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject, uploadBytesResumable } from 'firebase/storage'; // Import Storage functions
import { auth, db, storage } from './firebaseConfig'; // Import storage instance
import type { BusinessPlanData, ExportHistoryItem } from '../types';

export interface UserData {
    plans: BusinessPlanData[];
    archivedPlans: BusinessPlanData[];
    logoStoragePath?: string; // Path in Storage for the logo
    poCounter: number;
    exportHistory: Omit<ExportHistoryItem, 'pdfDataUrl'>[]; // pdfDataUrl should not be stored directly here
}

const getUserDocRef = (uid: string) => doc(db, 'users', uid);

/**
 * Helper function to recursively replace undefined values with null.
 * Firestore does not support undefined values.
 */
const cleanData = (data: any): any => {
    if (Array.isArray(data)) {
        return data.map(cleanData);
    } else if (data !== null && typeof data === 'object') {
        return Object.entries(data).reduce((acc, [key, value]) => {
            acc[key] = value === undefined ? null : cleanData(value);
            return acc;
        }, {} as any);
    }
    return data === undefined ? null : data;
};

/**
 * Uploads a file (base64 string or Blob) to Firebase Storage.
 * @param uid User ID
 * @param fileData The File object or Blob of the file.
 * @param storagePath The full path in Firebase Storage (e.g., 'users/UID/logos/logo.png').
 * @returns The download URL of the uploaded file.
 */
export const uploadFileToStorage = async (uid: string, fileData: File | Blob, storagePath: string): Promise<string> => {
    if (!uid) {
        console.error("[Storage Error] User not authenticated for Storage upload.");
        throw new Error("User not authenticated for Storage upload.");
    }
    console.log(`[Storage] Starting upload of file to: ${storagePath} for user: ${uid}`);

    try {
        const storageRef = ref(storage, storagePath);
        let snapshot;

        if (fileData instanceof File || fileData instanceof Blob) {
            const uploadTask = uploadBytesResumable(storageRef, fileData);
            
            // Optional: Listen for upload progress
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`[Storage] Upload to ${storagePath} is ${progress.toFixed(2)}% done`);
                }, 
                (error) => {
                    console.error(`[Storage Error] Upload progress error for ${storagePath}:`, error);
                    throw error; // Re-throw to be caught by the main catch block
                }
            );

            snapshot = await uploadTask; // Wait for the upload to complete
        } else {
            console.error("[Storage Error] Unsupported fileData format for upload (expected File or Blob).");
            throw new Error("Unsupported fileData format for upload (expected File or Blob).");
        }
        
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log(`[Storage] File uploaded successfully to ${storagePath}. Download URL: ${downloadURL}`);
        return downloadURL;
    } catch (error: any) {
        console.error(`[Storage Error] Error uploading file to Storage at ${storagePath}:`, error);
        throw new Error(`Storage upload failed for ${storagePath}: ${error.message || 'Unknown error'}`);
    }
};

/**
 * Retrieves the download URL for a file from Firebase Storage path.
 * @param storagePath The full path in Firebase Storage.
 * @returns The public download URL.
 */
export const getDownloadURLFromStoragePath = async (storagePath: string): Promise<string> => {
    console.log(`[Storage] Attempting to get download URL for path: ${storagePath}`);
    try {
        const storageRef = ref(storage, storagePath);
        const url = await getDownloadURL(storageRef);
        console.log(`[Storage] Download URL retrieved for ${storagePath}: ${url}`);
        return url;
    } catch (error: any) {
        console.error(`[Storage Error] Error getting download URL for ${storagePath}:`, error);
        throw new Error(`Failed to retrieve file from storage: ${error.message || 'Unknown error'}`);
    }
};

/**
 * Deletes a file from Firebase Storage.
 * @param storagePath The full path in Firebase Storage.
 */
export const deleteFileFromStorage = async (storagePath: string): Promise<void> => {
    if (!storagePath) {
        console.warn("[Storage] No storage path provided for deletion, skipping.");
        return; // Do nothing if no path
    }
    console.log(`[Storage] Attempting to delete file from Storage: ${storagePath}`);
    try {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
        console.log(`[Storage] File deleted from Storage: ${storagePath}`);
    } catch (error: any) {
        // Ignore "object not found" errors, just log others
        if (error.code === 'storage/object-not-found') {
            console.warn(`[Storage Warning] Attempted to delete non-existent file from Storage: ${storagePath}`);
        } else {
            console.error(`[Storage Error] Error deleting file from Storage ${storagePath}:`, error);
            throw new Error(`Failed to delete file from storage: ${error.message || 'Unknown error'}`);
        }
    }
};


/**
 * Saves or updates a portion of the user's data in Firestore.
 * Handles uploading large files (images/PDFs) to Storage and storing URLs in Firestore.
 */
export const saveUserData = async (uid: string, data: Partial<UserData>): Promise<void> => {
    if (!uid) {
        console.warn("[Firestore] No UID provided for saveUserData, skipping.");
        return; 
    }
    console.log(`[Firestore] Saving user data for ${uid}. Data keys: ${Object.keys(data).join(', ')}`);
    try {
        const userDocRef = getUserDocRef(uid);
        const sanitizedData = cleanData(data); // Ensure no undefined values

        // If plans or archivedPlans are being updated, ensure productImage is a URL, not base64.
        // This mapping is primarily for consistency and should already be handled by App.tsx logic.
        if (sanitizedData.plans) {
            sanitizedData.plans = sanitizedData.plans.map((plan: BusinessPlanData) => ({
                ...plan,
                products: plan.products.map(product => {
                    return product; 
                })
            }));
        }
        if (sanitizedData.archivedPlans) {
            sanitizedData.archivedPlans = sanitizedData.archivedPlans.map((plan: BusinessPlanData) => ({
                ...plan,
                products: plan.products.map(product => {
                    return product;
                })
            }));
        }

        await setDoc(userDocRef, sanitizedData, { merge: true });
        console.log(`[Firestore] User data saved successfully for ${uid}.`);
    } catch (error: any) {
        console.error(`[Firestore Error] Error saving user data for ${uid}:`, error);
        throw error;
    }
};


/**
 * Reads user data once (useful for migration checks).
 */
export const getUserDataOnce = async (uid: string): Promise<UserData | null> => {
    console.log(`[Firestore] Fetching user data once for ${uid}.`);
    const userDocRef = getUserDocRef(uid);
    try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
            console.log(`[Firestore] User data found for ${uid}.`);
            return snap.data() as UserData;
        }
        console.log(`[Firestore] No user data found for ${uid}.`);
        return null;
    } catch (error: any) {
        console.error(`[Firestore Error] Error fetching user data once for ${uid}:`, error);
        throw error;
    }
};

/**
 * Sets up a real-time listener for the user's data.
 */
export const onUserDataSnapshot = (uid: string, callback: (data: UserData | null) => void): (() => void) => {
    console.log(`[Firestore] Setting up real-time listener for user data for ${uid}.`);
    const userDocRef = getUserDocRef(uid);

    const unsubscribe = onSnapshot(
        userDocRef,
        (doc) => {
            if (doc.exists()) {
                console.log(`[Firestore] Real-time snapshot received for ${uid}.`);
                callback(doc.data() as UserData);
            } else {
                console.log(`[Firestore] Real-time snapshot received (document not found) for ${uid}.`);
                callback(null);
            }
        },
        (error) => {
            console.error(`[Firestore Error] Error listening to user data snapshot for ${uid}:`, error);
        }
    );

    return () => {
        unsubscribe();
        console.log(`[Firestore] Real-time listener unsubscribed for ${uid}.`);
    };
};

/**
 * Subscribes to authentication state changes.
 */
export const subscribeToAuthChanges = (callback: (user: User | null) => void): (() => void) => {
    console.log("[Auth] Subscribing to authentication state changes.");
    return onAuthStateChanged(auth, callback);
};

/**
 * Signs the user in with Google using a Popup.
 */
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