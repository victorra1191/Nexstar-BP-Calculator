
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
    if (!uid) throw new Error("User not authenticated for Storage upload.");

    const storageRef = ref(storage, storagePath);
    let snapshot;

    if (fileData instanceof File || fileData instanceof Blob) {
        // Use uploadBytesResumable for better handling of large files and consistency
        const uploadTask = uploadBytesResumable(storageRef, fileData);
        snapshot = await uploadTask; // Wait for the upload to complete
    } else {
        throw new Error("Unsupported fileData format for upload (expected File or Blob).");
    }
    
    return getDownloadURL(snapshot.ref);
};

/**
 * Retrieves the download URL for a file from Firebase Storage path.
 * @param storagePath The full path in Firebase Storage.
 * @returns The public download URL.
 */
export const getDownloadURLFromStoragePath = async (storagePath: string): Promise<string> => {
    const storageRef = ref(storage, storagePath);
    return getDownloadURL(storageRef);
};

/**
 * Deletes a file from Firebase Storage.
 * @param storagePath The full path in Firebase Storage.
 */
export const deleteFileFromStorage = async (storagePath: string): Promise<void> => {
    if (!storagePath) return; // Do nothing if no path
    try {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
        console.log(`File deleted from Storage: ${storagePath}`);
    } catch (error: any) {
        // Ignore "object not found" errors, just log others
        if (error.code === 'storage/object-not-found') {
            console.warn(`Attempted to delete non-existent file from Storage: ${storagePath}`);
        } else {
            console.error(`Error deleting file from Storage ${storagePath}:`, error);
            throw error;
        }
    }
};


/**
 * Saves or updates a portion of the user's data in Firestore.
 * Handles uploading large files (images/PDFs) to Storage and storing URLs in Firestore.
 */
export const saveUserData = async (uid: string, data: Partial<UserData>): Promise<void> => {
    if (!uid) return; 
    try {
        const userDocRef = getUserDocRef(uid);
        const sanitizedData = cleanData(data); // Ensure no undefined values

        // If plans or archivedPlans are being updated, ensure productImage is a URL, not base64.
        if (sanitizedData.plans) {
            sanitizedData.plans = sanitizedData.plans.map((plan: BusinessPlanData) => ({
                ...plan,
                products: plan.products.map(product => {
                    // product.productImage should already be a URL after upload in App.tsx
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
    } catch (error) {
        console.error("Error saving user data to Firestore:", error);
        throw error;
    }
};


/**
 * Reads user data once (useful for migration checks).
 */
export const getUserDataOnce = async (uid: string): Promise<UserData | null> => {
    const userDocRef = getUserDocRef(uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
        return snap.data() as UserData;
    }
    return null;
};

/**
 * Sets up a real-time listener for the user's data.
 */
export const onUserDataSnapshot = (uid: string, callback: (data: UserData | null) => void): (() => void) => {
    const userDocRef = getUserDocRef(uid);

    const unsubscribe = onSnapshot(
        userDocRef,
        (doc) => {
            if (doc.exists()) {
                callback(doc.data() as UserData);
            } else {
                callback(null);
            }
        },
        (error) => {
            console.error("Error listening to user data snapshot:", error);
        }
    );

    return unsubscribe;
};

/**
 * Subscribes to authentication state changes.
 */
export const subscribeToAuthChanges = (callback: (user: User | null) => void): (() => void) => {
    return onAuthStateChanged(auth, callback);
};

/**
 * Signs the user in with Google using a Popup.
 */
export const signInWithGoogle = async (): Promise<void> => {
    const provider = new GoogleAuthProvider();
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Error signing in with Google:", error);
        throw error;
    }
};

export const signOut = (): Promise<void> => {
    return firebaseSignOut(auth);
};