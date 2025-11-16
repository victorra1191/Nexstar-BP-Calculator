import firebase from 'firebase/compat/app';
import { auth, db } from './firebaseConfig';
import type { BusinessPlanData, ExportHistoryItem } from '../types';

export interface UserData {
    plans: BusinessPlanData[];
    archivedPlans: BusinessPlanData[];
    logo: string;
    poCounter: number;
    exportHistory: ExportHistoryItem[];
}

const getUserDocRef = (uid: string) => db.collection('users').doc(uid);

/**
 * Saves or updates a portion of the user's data in Firestore.
 * @param uid The user's unique ID.
 * @param data A partial object of the user's data to save.
 */
export const saveUserData = async (uid: string, data: Partial<UserData>): Promise<void> => {
    if (!uid) throw new Error("User ID is required to save data.");
    try {
        const userDocRef = getUserDocRef(uid);
        await userDocRef.set(data, { merge: true });
    } catch (error) {
        console.error("Error saving user data to Firestore:", error);
        throw error; // Re-throw to be handled by the caller
    }
};


/**
 * Sets up a real-time listener for the user's data.
 * @param uid The user's unique ID.
 * @param callback The function to call with the data whenever it changes.
 * @returns An unsubscribe function to detach the listener.
 */
export const onUserDataSnapshot = (uid: string, callback: (data: UserData | null) => void): (() => void) => {
    const userDocRef = getUserDocRef(uid);

    const unsubscribe = userDocRef.onSnapshot(
        (doc) => {
            if (doc.exists) {
                callback(doc.data() as UserData);
            } else {
                // If the user has no data yet, provide a default structure
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
 * Signs the user in with Google using a redirect.
 * It sets auth persistence to 'none' to work in environments with disabled web storage.
 * This means the user will have to sign in again after a page refresh.
 */
export const signInWithGoogle = (): Promise<void> => {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    // Set persistence to 'none' to avoid web storage issues in sandboxed iframes.
    // The user's session will not be remembered across page reloads.
    return auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
        .then(() => {
            return auth.signInWithRedirect(provider);
        })
        .catch((error) => {
            console.error("Error setting auth persistence to 'none'. Trying redirect anyway.", error);
            // Fallback to trying the redirect if setting persistence fails.
            return auth.signInWithRedirect(provider);
        });
};

/**
 * Gets the result of a redirect sign-in operation. Should be called when the app loads.
 * @returns A promise that resolves with the user credential if sign-in was successful, or null.
 */
export const getRedirectResult = (): Promise<firebase.auth.UserCredential | null> => {
    return auth.getRedirectResult();
};


/**
 * Signs the user out.
 */
export const signOut = (): Promise<void> => {
    return auth.signOut();
};