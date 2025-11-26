import { 
    GoogleAuthProvider, 
    setPersistence, 
    browserLocalPersistence, 
    signInWithRedirect, 
    getRedirectResult as firebaseGetRedirectResult, 
    signOut as firebaseSignOut, 
    onAuthStateChanged,
    User,
    UserCredential 
} from 'firebase/auth';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import type { BusinessPlanData, ExportHistoryItem } from '../types';

export interface UserData {
    plans: BusinessPlanData[];
    archivedPlans: BusinessPlanData[];
    logo: string;
    poCounter: number;
    exportHistory: ExportHistoryItem[];
}

const getUserDocRef = (uid: string) => doc(db, 'users', uid);

/**
 * Saves or updates a portion of the user's data in Firestore.
 */
export const saveUserData = async (uid: string, data: Partial<UserData>): Promise<void> => {
    if (!uid) return; // Fail silently if no user, or handle as needed
    try {
        const userDocRef = getUserDocRef(uid);
        await setDoc(userDocRef, data, { merge: true });
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
}

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
 * Signs the user in with Google using a redirect.
 */
export const signInWithGoogle = (): Promise<void> => {
    const provider = new GoogleAuthProvider();
    return setPersistence(auth, browserLocalPersistence)
        .then(() => {
            return signInWithRedirect(auth, provider);
        })
        .catch((error) => {
            console.error("Error setting auth persistence:", error);
            return signInWithRedirect(auth, provider);
        });
};

export const getRedirectResult = (): Promise<UserCredential | null> => {
    return firebaseGetRedirectResult(auth);
};

export const signOut = (): Promise<void> => {
    return firebaseSignOut(auth);
};