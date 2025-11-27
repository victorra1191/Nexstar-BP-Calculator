
import React, { useState, useRef, useEffect } from 'react';
import BusinessPlan from './components/BusinessPlan';
import PurchaseOrder from './components/PurchaseOrder';
import DataInputForm from './components/DataInputForm';
import SavedPlans from './components/SavedPlans';
import Logo from './components/Logo';
import { generateBusinessPlanSummary, translateTextToChinese } from './services/geminiService';
import { 
    signInWithGoogle, 
    signOut, 
    subscribeToAuthChanges, 
    saveUserData, 
    onUserDataSnapshot, 
    getUserDataOnce,
    uploadFileToStorage,
    deleteFileFromStorage,
    getDownloadURLFromStoragePath,
    type UserData 
} from './services/firestoreService';
import type { BusinessPlanData, ViewType, AppView, ExportHistoryItem, ExportHistoryItemWithUrl } from './types';
import type { User } from 'firebase/auth';

const APP_VERSION = "v2.2.10"; // Updated version for PDF size optimization

// Helper to convert File to Base64 (used for preview before upload to storage)
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

interface PDFExportButtonProps {
    onClick: () => Promise<void>;
    isExporting: boolean;
    librariesLoaded: boolean;
}

const PDFExportButton: React.FC<PDFExportButtonProps> = ({ onClick, isExporting, librariesLoaded }) => {
    const getButtonContent = () => {
        if (!librariesLoaded) {
            return 'Loading Libraries...';
        }
        if (isExporting) {
            return 'Exporting...';
        }
        return (
            <>
                {/* Updated SVG path to a well-formed version */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4m-4 4V4m-8 8v4a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4m-8 8v4a3 3 0 003 3h10a3 3 0 003-3v-4" /></svg>
                Download PDF
            </>
        );
    };
    
    return (
        <button
            onClick={onClick} disabled={isExporting || !librariesLoaded}
            className="bg-primary text-white font-bold py-2 px-5 rounded-lg hover:bg-primary-hover transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transform hover:-translate-y-0.5 min-w-[160px]"
        >
             {getButtonContent()}
        </button>
    );
};

const App: React.FC = () => {
    // Auth State
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    // App Data State
    const [plans, setPlans] = useState<BusinessPlanData[]>([]);
    const [archivedPlans, setArchivedPlans] = useState<BusinessPlanData[]>([]);
    const [appView, setAppView] = useState<AppView>('dashboard');
    const [selectedPlan, setSelectedPlan] = useState<BusinessPlanData | null>(null);
    const [activeReportView, setActiveReportView] = useState<ViewType>('plan');
    const [containerCount, setContainerCount] = useState(1);
    const [poCounter, setPoCounter] = useState(1);
    const [logoUrl, setLogoUrl] = useState(''); // Stores URL from Storage
    const [logoStoragePath, setLogoStoragePath] = useState<string | null>(null); // Stores path in Storage (null for empty)
    const [formInitialData, setFormInitialData] = useState<BusinessPlanData | undefined>(undefined);
    const [currentPoNumber, setCurrentPoNumber] = useState('');
    // Fix: Updated type to include pdfDataUrl for display purposes
    const [exportHistory, setExportHistory] = useState<ExportHistoryItemWithUrl[]>([]); 
    
    // UI State
    const [isExporting, setIsExporting] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyPdfDataUrl, setHistoryPdfDataUrl] = useState<string | null>(null); // For displaying in modal (public URL)
    const [pdfLibrariesLoaded, setPdfLibrariesLoaded] = useState(false);
    const [generatingSummaryForPlanId, setGeneratingSummaryForPlanId] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    
    const businessPlanRef = useRef<HTMLDivElement>(null);
    const businessPlanChineseRef = useRef<HTMLDivElement>(null);
    const purchaseOrderRef = useRef<HTMLDivElement>(null);

    // 1. Initialize Auth and Data Sync
    useEffect(() => {
        const unsubscribeAuth = subscribeToAuthChanges(async (currentUser) => {
            setUser(currentUser);
            setSyncError(null);
            
            if (currentUser) {
                console.log(`[Auth] User logged in: ${currentUser.uid}`);
                // User is logged in. Check for migration and subscribe to data.
                
                // MIGRATION CHECK:
                console.log("[Migration] Checking for existing cloud data...");
                const cloudData = await getUserDataOnce(currentUser.uid);
                const localDataString = localStorage.getItem('nexstar_data');
                
                if (!cloudData && localDataString) {
                    try {
                        console.log("[Migration] Local data found, attempting migration to cloud...");
                        const localData = JSON.parse(localDataString);
                        

                        // Handle logo migration (if present in local storage)
                        let migratedLogoStoragePath: string | null = null;
                        if (localData.logo && currentUser) {
                            // If localData.logo is base64, upload it
                            if (localData.logo.startsWith('data:image')) {
                                console.log("[Migration] Uploading logo from local base64 to Storage.");
                                const logoBlob = await (await fetch(localData.logo)).blob();
                                migratedLogoStoragePath = `users/${currentUser.uid}/logos/user_logo_${new Date().getTime()}`;
                                await uploadFileToStorage(currentUser.uid, logoBlob, migratedLogoStoragePath);
                                console.log(`[Migration] Logo uploaded to: ${migratedLogoStoragePath}`);
                            } else {
                                migratedLogoStoragePath = localData.logo; // Assume it's already a Storage path/URL
                                console.log(`[Migration] Logo path already in cloud format: ${migratedLogoStoragePath}`);
                            }
                        }

                        // Adjust plans and product images if they are base64
                        const migratePlans = async (plansToMigrate: BusinessPlanData[]) => {
                            return Promise.all(plansToMigrate.map(async plan => {
                                const productsWithMigratedImages = await Promise.all(plan.products.map(async product => {
                                    if (product.productImage && product.productImage.startsWith('data:image')) {
                                        console.log(`[Migration] Uploading product image from local base64 for product ${product.id} to Storage.`);
                                        const imageBlob = await (await fetch(product.productImage)).blob();
                                        const storagePath = `users/${currentUser.uid}/product_images/${product.id}_${new Date().getTime()}`;
                                        const imageUrl = await uploadFileToStorage(currentUser.uid, imageBlob, storagePath);
                                        console.log(`[Migration] Product image uploaded to: ${storagePath}`);
                                        return { ...product, productImage: imageUrl };
                                    }
                                    return product;
                                }));
                                return { ...plan, products: productsWithMigratedImages };
                            }));
                        };

                        const migratedPlans = await migratePlans(localData.plans || []);
                        const migratedArchivedPlans = await migratePlans(localData.archivedPlans || []);

                        // Adjust exportHistory to remove pdfDataUrl before saving to cloud
                        const migratedExportHistory = await Promise.all((localData.exportHistory || []).map(async (item: any) => {
                            if (item.pdfDataUrl && item.pdfDataUrl.startsWith('data:application/pdf')) {
                                console.log(`[Migration] Uploading PDF for history item ${item.id} to Storage.`);
                                const pdfBlob = await (await fetch(item.pdfDataUrl)).blob();
                                const storagePath = `users/${currentUser.uid}/pdf_exports/${item.id}_${new Date().getTime()}.pdf`;
                                await uploadFileToStorage(currentUser.uid, pdfBlob, storagePath);
                                console.log(`[Migration] PDF uploaded to: ${storagePath}`);
                                const { pdfDataUrl, ...rest } = item;
                                return { ...rest, pdfStoragePath: storagePath };
                            }
                            const { pdfDataUrl, ...rest } = item; // Ensure pdfDataUrl is NOT stored directly in Firestore document
                            return rest;
                        }));

                        console.log("[Migration] Saving migrated data to Firestore...");
                        await saveUserData(currentUser.uid, {
                            plans: migratedPlans,
                            archivedPlans: migratedArchivedPlans,
                            logoStoragePath: migratedLogoStoragePath, // Store path from Storage
                            poCounter: localData.poCounter || 1,
                            exportHistory: migratedExportHistory
                        });
                        localStorage.removeItem('nexstar_data'); // Clear local data after successful migration
                        console.log("[Migration] Local data migration complete and cleared.");
                    } catch (e: any) {
                        console.error("[Migration Error] Failed to migrate local data to cloud:", e);
                        setSyncError(`Failed to migrate local data to cloud: ${e.message || 'Unknown error'}`);
                    }
                }

                // SUBSCRIBE TO FIRESTORE
                console.log("[Firestore] Subscribing to user data snapshot...");
                const unsubscribeFirestore = onUserDataSnapshot(currentUser.uid, async (data) => {
                    if (data) {
                        console.log("[Firestore] User data snapshot received:", data);
                        // Retrieve logo URL from Storage if path exists
                        if (data.logoStoragePath) {
                            try {
                                console.log(`[Storage] Attempting to get download URL for logo: ${data.logoStoragePath}`);
                                const url = await getDownloadURLFromStoragePath(data.logoStoragePath);
                                setLogoUrl(url);
                                setLogoStoragePath(data.logoStoragePath);
                                console.log(`[Storage] Logo URL retrieved: ${url}`);
                            } catch (e: any) {
                                console.warn(`[Storage Error] Could not get download URL for logo ${data.logoStoragePath}:`, e);
                                setSyncError(`Failed to load logo from storage: ${e.message || 'Unknown error'}. Check Storage Rules.`);
                                setLogoUrl('');
                                setLogoStoragePath(null);
                            }
                        } else {
                            setLogoUrl('');
                            setLogoStoragePath(null);
                            console.log("[Storage] No logo path found, logo cleared.");
                        }

                        // Pre-fetch product image URLs for plans
                        const plansWithImages = await Promise.all((data.plans || []).map(async plan => {
                            const productsWithMigratedImages = await Promise.all(plan.products.map(async product => {
                                if (product.productImage && !product.productImage.startsWith('http')) { // If it's a storage path
                                    try {
                                        console.log(`[Storage] Attempting to get download URL for product image: ${product.productImage}`);
                                        const url = await getDownloadURLFromStoragePath(product.productImage);
                                        return { ...product, productImage: url };
                                    } catch (e: any) {
                                        console.warn(`[Storage Error] Could not get download URL for ${product.productImage} for plan ${plan.id}:`, e);
                                        setSyncError(`Failed to load image for ${product.nexstarModel}: ${e.message || 'Unknown error'}. Check Storage Rules.`);
                                        return { ...product, productImage: '' }; // Fallback to empty if URL fails
                                    }
                                }
                                return product;
                            }));
                            return { ...plan, products: productsWithMigratedImages };
                        }));
                        setPlans(plansWithImages);
                        console.log("[Firestore] Plans loaded with image URLs.");

                        const archivedPlansWithImages = await Promise.all((data.archivedPlans || []).map(async plan => {
                            const productsWithMigratedImages = await Promise.all(plan.products.map(async product => {
                                if (product.productImage && !product.productImage.startsWith('http')) { // If it's a storage path
                                    try {
                                        console.log(`[Storage] Attempting to get download URL for archived product image: ${product.productImage}`);
                                        const url = await getDownloadURLFromStoragePath(product.productImage);
                                        return { ...product, productImage: url };
                                    } catch (e: any) {
                                        console.warn(`[Storage Error] Could not get download URL for archived ${product.productImage} for plan ${plan.id}:`, e);
                                        setSyncError(`Failed to load archived image for ${product.nexstarModel}: ${e.message || 'Unknown error'}. Check Storage Rules.`);
                                        return { ...product, productImage: '' }; // Fallback to empty if URL fails
                                    }
                                }
                                return product;
                            }));
                            // Fix: Corrected typo 'productsWithMigigatedImages' to 'productsWithMigratedImages'
                            return { ...plan, products: productsWithMigratedImages };
                        }));
                        setArchivedPlans(archivedPlansWithImages);
                        console.log("[Firestore] Archived plans loaded with image URLs.");

                        setPoCounter(data.poCounter || 1);
                        // Fetch PDF URLs for export history
                        const historyWithUrls: ExportHistoryItemWithUrl[] = await Promise.all((data.exportHistory || []).map(async item => {
                            if (item.pdfStoragePath) {
                                try {
                                    console.log(`[Storage] Attempting to get download URL for history PDF: ${item.pdfStoragePath}`);
                                    const url = await getDownloadURLFromStoragePath(item.pdfStoragePath);
                                    return { ...item, pdfDataUrl: url }; // Store public URL for display
                                } catch (e: any) {
                                    console.warn(`[Storage Error] Could not get download URL for PDF history item ${item.id}:`, e);
                                    setSyncError(`Failed to load PDF for history item ${item.id}: ${e.message || 'Unknown error'}. Check Storage Rules.`);
                                    return { ...item, pdfDataUrl: null }; // Fallback
                                }
                            }
                            return item;
                        }));
                        setExportHistory(historyWithUrls);
                        console.log("[Firestore] Export history loaded with PDF URLs.");

                    } else {
                        // New user with no data
                        console.log("[Firestore] No user data found, initializing empty state.");
                        setPlans([]);
                        setArchivedPlans([]);
                        setLogoUrl('');
                        setLogoStoragePath(null);
                        setPoCounter(1);
                        setExportHistory([]);
                    }
                });
                
                setAuthLoading(false);
                return () => {
                    unsubscribeFirestore();
                    console.log("[Firestore] Unsubscribed from user data snapshot.");
                };
            } else {
                // User is logged out.
                console.log("[Auth] User logged out.");
                setPlans([]);
                setArchivedPlans([]);
                setLogoUrl('');
                setLogoStoragePath(null);
                setAuthLoading(false);
            }
        });

        // Load PDF Libs
        console.log("[PDF Libraries] Attempting to load html2canvas and jspdf...");
        const loadScript = (src: string): Promise<void> => {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) return resolve();
                const script = document.createElement('script');
                script.src = src;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error(`Failed to load script ${src}`));
                document.head.appendChild(script);
            });
        };
        Promise.all([
            loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"),
            loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js")
        ]).then(() => {
            setPdfLibrariesLoaded(true);
            console.log("[PDF Libraries] Loaded successfully.");
        })
        .catch(error => {
            console.error("[PDF Libraries Error]", error);
            setSyncError("Failed to load PDF export libraries. Please check your internet connection.");
        });

        return () => {
            unsubscribeAuth();
            console.log("[Auth] Unsubscribed from auth changes.");
        };
    }, [user?.uid]); // Re-run effect if user UID changes for proper subscription/migration

    // Helper to persist data to Firestore if logged in
    const persistData = async (updates: Partial<UserData>) => {
        if (user) {
            try {
                console.log("[Firestore] Attempting to save data:", Object.keys(updates));
                await saveUserData(user.uid, updates);
                setSyncError(null);
                console.log("[Firestore] Data saved successfully.");
            } catch (error: any) {
                console.error("[Firestore Save Error]:", error);
                if (error.code === 'permission-denied') {
                    setSyncError("Permission Denied: Please update your Firestore Database Rules in Firebase Console to allow writes.");
                } else if (error.code === 'resource-exhausted') {
                    setSyncError(`Failed to save: Your business plan data (text, URLs, numbers, etc. within the Firestore document) is too large for a single document (max 1MB). This is not about image file size directly, but the metadata. Consider reducing summary length or number of products. Error: ${error.message}`);
                } else if (error.code && error.code.startsWith('storage/')) {
                     setSyncError(`Storage Error during Firestore save: ${error.message || 'Unknown storage error'}. This usually means there's an issue with Storage Rules or the file path.`);
                }
                else {
                    // Display the actual error message to help debugging
                    setSyncError(`Failed to save: ${error.message || 'Unknown error'}`);
                }
            }
        } else {
            console.warn("[Firestore Save Warning] User not logged in, cannot save data to cloud.");
            setSyncError("Not logged in. Data not saved to cloud.");
        }
    };

    const handleLogin = async () => {
        try {
            console.log("[Auth] Attempting Google Sign-in...");
            await signInWithGoogle();
            console.log("[Auth] Google Sign-in successful.");
        } catch (error: any) {
            console.error("[Auth Error] Login error:", error);
            let msg = "Failed to sign in.";
            if (error.code === 'auth/configuration-not-found') {
                msg = "Google Sign-In is disabled. Please go to Firebase Console > Authentication > Sign-in method and enable the 'Google' provider.";
            } else if (error.code === 'auth/unauthorized-domain') {
                msg = "This domain is not authorized. Please go to Firebase Console > Authentication > Settings > Authorized domains and add this domain.";
            } else if (error.code === 'auth/popup-closed-by-user') {
                msg = "Sign-in cancelled.";
            } else {
                msg = error.message;
            }
            alert(msg);
            setSyncError(msg);
        }
    };

    const handleSavePlan = async (planData: Omit<BusinessPlanData, 'id' | 'aiSummary' | 'createdAt' | 'updatedAt'>) => {
        if (!user) {
            alert("Please sign in to save plans.");
            console.warn("[Plan Save] User not logged in, cannot save plan.");
            return;
        }
        
        setGeneratingSummaryForPlanId('new');
        console.log("[Gemini] Generating AI summary for new/updated plan...");
        const summary = await generateBusinessPlanSummary(planData as BusinessPlanData);
        setGeneratingSummaryForPlanId(null);
        console.log("[Gemini] AI summary generation complete.");
        
        const existingPlan = plans.find(p => p.id === formInitialData?.id);
        let updatedPlans: BusinessPlanData[];
        let planToSave: BusinessPlanData;
        
        // Use null instead of undefined for Firestore compatibility
        if (existingPlan) {
             planToSave = { ...existingPlan, ...planData, aiSummary: summary, aiSummaryChinese: null, updatedAt: new Date().toISOString() };
             updatedPlans = plans.map(p => p.id === existingPlan.id ? planToSave : p);
             console.log(`[Plan Save] Updating existing plan: ${planToSave.id}`);
        } else {
             planToSave = { ...planData, id: new Date().toISOString(), aiSummary: summary, aiSummaryChinese: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
             updatedPlans = [...plans, planToSave];
             console.log(`[Plan Save] Creating new plan: ${planToSave.id}`);
        }
        
        setPlans(updatedPlans); // Optimistic update
        await persistData({ plans: updatedPlans });
        setAppView('dashboard');
        setFormInitialData(undefined);
        console.log("[Plan Save] Plan saved and UI updated.");
    };
    
    const handleRetrySummary = async (planId: string) => {
        const planToUpdate = plans.find(p => p.id === planId);
        if (!planToUpdate) {
            console.warn(`[Gemini] Plan ${planId} not found for summary retry.`);
            return;
        }

        setGeneratingSummaryForPlanId(planId);
        console.log(`[Gemini] Retrying AI summary for plan ${planId}...`);
        const newSummary = await generateBusinessPlanSummary(planToUpdate);
        setGeneratingSummaryForPlanId(null);
        console.log(`[Gemini] AI summary re-generated for plan ${planId}.`);

        // Use null instead of undefined
        const updatedPlan = { ...planToUpdate, aiSummary: newSummary, aiSummaryChinese: null, updatedAt: new Date().toISOString() };
        const updatedPlans = plans.map(p => p.id === planId ? updatedPlan : p);
        
        setPlans(updatedPlans);
        await persistData({ plans: updatedPlans });
        if (selectedPlan?.id === planId) {
            setSelectedPlan(updatedPlan);
        }
        console.log(`[Gemini] Summary retry for plan ${planId} completed.`);
    };

    const handleTranslateSummary = async (planId: string) => {
        const planToUpdate = plans.find(p => p.id === planId);
        if (!planToUpdate || !planToUpdate.aiSummary || planToUpdate.aiSummary.startsWith('Failed')) {
            console.warn(`[Gemini] Plan ${planId} not found or summary failed/missing for translation.`);
            return;
        }
        
        setIsTranslating(true);
        console.log(`[Gemini] Translating summary for plan ${planId} to Chinese...`);
        const translation = await translateTextToChinese(planToUpdate.aiSummary);
        setIsTranslating(false);
        console.log(`[Gemini] Translation for plan ${planId} complete.`);

        const updatedPlan = { ...planToUpdate, aiSummaryChinese: translation, updatedAt: new Date().toISOString() };
        const updatedPlans = plans.map(p => p.id === planId ? updatedPlan : p);

        setPlans(updatedPlans);
        await persistData({ plans: updatedPlans });
        if (selectedPlan?.id === planId) {
            setSelectedPlan(updatedPlan);
        }
        console.log(`[Gemini] Translation for plan ${planId} completed.`);
    };

    const handleSelectPlan = (planId: string) => {
        const plan = plans.find(p => p.id === planId);
        if (plan) {
            setSelectedPlan(plan);
            setContainerCount(1);
            setActiveReportView('plan');
            setCurrentPoNumber('');
            setAppView('view_plan');
            console.log(`[Navigation] Selected plan ${planId}: ${plan.planName}`);
        } else {
            console.warn(`[Navigation] Plan ${planId} not found.`);
        }
    };
    
    const handleArchivePlan = async (planId: string) => {
        const planToArchive = plans.find(p => p.id === planId);
        if (planToArchive) {
            const newPlans = plans.filter(p => p.id !== planId);
            const newArchivedPlans = [planToArchive, ...archivedPlans];
            setPlans(newPlans);
            setArchivedPlans(newArchivedPlans);
            await persistData({ plans: newPlans, archivedPlans: newArchivedPlans });
            console.log(`[Plan Management] Plan ${planId} archived.`);
        } else {
            console.warn(`[Plan Management] Plan ${planId} not found for archiving.`);
        }
    };
    
    const handleRestorePlan = async (planId: string) => {
        const planToRestore = archivedPlans.find(p => p.id === planId);
        if (planToRestore) {
            const newArchivedPlans = archivedPlans.filter(p => p.id !== planId);
            const newPlans = [planToRestore, ...plans];
            setArchivedPlans(newArchivedPlans);
            setPlans(newPlans);
            await persistData({ plans: newPlans, archivedPlans: newArchivedPlans });
            console.log(`[Plan Management] Plan ${planId} restored.`);
        } else {
            console.warn(`[Plan Management] Plan ${planId} not found for restoring.`);
        }
    };

    const handleDeletePermanently = async (planId: string) => {
        if (!user) {
            alert("You must be signed in to delete files from cloud storage permanently.");
            console.warn("[Plan Delete] User not signed in, cannot delete permanently.");
            return;
        }
        if (!window.confirm("This action is permanent and cannot be undone. Are you sure you want to delete this plan forever? All associated images and PDFs will also be deleted from storage.")) return;
        
        const planToDelete = archivedPlans.find(p => p.id === planId);
        if (planToDelete) {
            // Delete associated images from Storage
            for (const product of planToDelete.products) {
                // Check if it's a storage path (not a full http URL already)
                if (product.productImage && !product.productImage.startsWith('http')) { 
                    try {
                        console.log(`[Storage] Attempting to delete product image: ${product.productImage}`);
                        await deleteFileFromStorage(product.productImage); // Delete using path
                        console.log(`[Storage] Deleted product image: ${product.productImage}`);
                    } catch (error: any) {
                        console.error(`[Storage Error] Error deleting product image ${product.productImage}:`, error);
                        setSyncError(`Failed to delete product image ${product.nexstarModel}: ${error.message || 'Unknown error'}. Check Storage Rules.`);
                    }
                } else if (product.productImage) {
                    console.log(`[Storage] Product image ${product.productImage} is likely an external URL or already deleted, skipping storage deletion.`);
                }
            }
            
            // Delete associated PDFs from Storage
            const historyItemsToDelete = exportHistory.filter(item => item.planModel === planToDelete.planName && item.pdfStoragePath);
            for (const item of historyItemsToDelete) {
                if (item.pdfStoragePath) {
                    try {
                        console.log(`[Storage] Attempting to delete PDF: ${item.pdfStoragePath}`);
                        await deleteFileFromStorage(item.pdfStoragePath); // Delete using path
                        console.log(`[Storage] Deleted PDF: ${item.pdfStoragePath}`);
                    } catch (error: any) {
                        console.error(`[Storage Error] Error deleting PDF ${item.pdfStoragePath}:`, error);
                        setSyncError(`Failed to delete PDF history item ${item.id}: ${error.message || 'Unknown error'}. Check Storage Rules.`);
                    }
                }
            }
            
            const newArchivedPlans = archivedPlans.filter(p => p.id !== planId);
            setArchivedPlans(newArchivedPlans);
            await persistData({ archivedPlans: newArchivedPlans });
            console.log(`[Plan Management] Plan ${planId} permanently deleted.`);
        } else {
            console.warn(`[Plan Delete] Plan ${planId} not found for permanent deletion.`);
        }
    };
    
    const handleEditPlan = (planId: string) => {
        const planToEdit = plans.find(p => p.id === planId);
        if (planToEdit) {
            setFormInitialData(planToEdit);
            setAppView('new_plan');
            console.log(`[Navigation] Editing plan ${planId}.`);
        } else {
            console.warn(`[Navigation] Plan ${planId} not found for editing.`);
        }
    };

    const handleDuplicatePlan = (planId: string) => {
        const planToDuplicate = plans.find(p => p.id === planId);
        if (planToDuplicate) {
            // Ensure duplicated plan gets new IDs and storage paths for images if any
            const duplicatedProducts = planToDuplicate.products.map(p => ({
                ...p,
                id: `product_${new Date().getTime()}_${Math.random()}_copy`,
                // productImage will reference same Storage URL for now, could be re-uploaded if needed
            }));
            const duplicatedData = { ...planToDuplicate, id: '', planName: `${planToDuplicate.planName} (Copy)`, products: duplicatedProducts };
            setFormInitialData(duplicatedData);
            setAppView('new_plan');
            console.log(`[Plan Management] Duplicating plan ${planId}.`);
        } else {
            console.warn(`[Plan Management] Plan ${planId} not found for duplication.`);
        }
    };
    
    const handleNewPlan = () => {
        setFormInitialData(undefined);
        setAppView('new_plan');
        console.log("[Navigation] Creating new plan.");
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!user) {
            alert("Please sign in to upload a logo to cloud storage.");
            console.warn("[Storage Error] User not signed in. Cannot upload logo.");
            return;
        }
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const storagePath = `users/${user.uid}/logos/user_logo_${file.name}_${new Date().getTime()}`; // Unique path for logo
            console.log(`[Storage] Attempting to upload logo: ${file.name} to ${storagePath}`);
            try {
                const downloadUrl = await uploadFileToStorage(user.uid, file, storagePath);
                setLogoUrl(downloadUrl); // Store URL
                setLogoStoragePath(storagePath); // Update the path state
                await persistData({ logoStoragePath: storagePath }); // Store path in Firestore
                console.log(`[Storage] Logo uploaded successfully: ${downloadUrl}`);
            } catch (error: any) {
                console.error("[Storage Error] Error uploading logo:", error);
                setSyncError(`Failed to upload logo: ${error.message || 'Unknown error'}. Please check Storage Rules.`);
            }
        }
    };
    
    // This handler will be passed to DataInputForm for product image uploads
    const handleProductImageUpload = async (productId: string, file: File): Promise<string> => {
        if (!user) {
            console.error("[Storage Error] User not signed in. Cannot upload product image.");
            throw new Error("User not signed in. Cannot upload product image.");
        }
        const storagePath = `users/${user.uid}/product_images/${productId}_${file.name}_${new Date().getTime()}`;
        console.log(`[Storage] Attempting to upload product image for ${productId}: ${file.name} to ${storagePath}`);
        try {
            const downloadUrl = await uploadFileToStorage(user.uid, file, storagePath);
            console.log(`[Storage] Product image uploaded successfully for ${productId}: ${downloadUrl}`);
            return downloadUrl; // Return the URL to be stored in product data
        } catch (error: any) {
            console.error(`[Storage Error] Error uploading product image for ${productId} to storage:`, error);
            // Re-throw to be caught by DataInputForm for product-specific error message
            throw new Error(`Upload failed: ${error.message || 'Unknown error'}`); 
        }
    };


    const handleViewReport = (view: ViewType) => {
        if (view === 'po' && activeReportView !== 'po') {
            const nextPoCounter = poCounter + 1;
            const number = `PO-${new Date().getFullYear()}-${String(poCounter).padStart(4, '0')}`;
            setCurrentPoNumber(number);
            setPoCounter(nextPoCounter);
            persistData({ poCounter: nextPoCounter });
            console.log(`[Report] Switched to PO view. New PO number: ${number}`);
        }
        setActiveReportView(view);
        console.log(`[Report] Switched to ${view} view.`);
    };

    const handleAddToHistory = async (type: ViewType, pdfDataUrl: string) => {
        if (!user || !selectedPlan) {
            console.warn("[History] User not logged in or no plan selected, cannot add to history.");
            return;
        }
        
        const storagePath = `users/${user.uid}/pdf_exports/${selectedPlan.id}_${type}_${new Date().getTime()}.pdf`;
        console.log(`[Storage] Attempting to upload PDF to history: ${storagePath}`);
        try {
            const fileBlob = await fetch(pdfDataUrl).then(res => res.blob());
            await uploadFileToStorage(user.uid, fileBlob, storagePath); // Upload PDF to storage
            // No need to get download URL here, just store the path
            console.log(`[Storage] PDF uploaded to history successfully: ${storagePath}`);

            const newItem: ExportHistoryItemWithUrl = { // Use ExportHistoryItemWithUrl for the item being added to state
                id: `${new Date().toISOString()}-${Math.random()}`,
                type,
                planModel: selectedPlan.planName,
                exportedAt: new Date().toISOString(),
                status: 'pending',
                pdfStoragePath: storagePath, // Store path to Storage
                pdfDataUrl: pdfDataUrl, // Store public URL for display in UI
            };

            if (type === 'po') {
                newItem.poNumber = currentPoNumber;
                newItem.containerCount = containerCount;
            }

            const newHistory = [newItem, ...exportHistory];
            setExportHistory(newHistory);
            
            // Only store item properties relevant to Firestore, exclude large data like pdfDataUrl
            const historyToSave = newHistory.map(item => {
                // Ensure pdfDataUrl is not saved, only pdfStoragePath
                const { pdfDataUrl, ...rest } = item; 
                return { ...rest, pdfStoragePath: item.pdfStoragePath || null }; // Store path
            });
            await persistData({ exportHistory: historyToSave });
            console.log(`[History] Added new item to export history: ${newItem.id}`);

        } catch (error: any) {
            console.error("[Storage Error] Error adding to history/uploading PDF:", error);
            setSyncError(`Failed to save PDF to history: ${error.message || 'Unknown error'}. Please check Storage Rules.`);
        }
    };

    const handleViewHistoryItem = async (itemId: string) => {
        const item = exportHistory.find(h => h.id === itemId);
        if (item && item.pdfStoragePath && user) {
            console.log(`[History] Retrieving PDF for history item ${itemId} from storage.`);
            try {
                const url = await getDownloadURLFromStoragePath(item.pdfStoragePath);
                setHistoryPdfDataUrl(url); // Now this is a public download URL
                setHistoryModalOpen(true);
                console.log(`[History] PDF URL retrieved: ${url}`);
            } catch (error: any) {
                console.error("[Storage Error] Error retrieving PDF from storage:", error);
                setSyncError(`Failed to retrieve PDF: ${error.message || 'Unknown error'}. It might have been deleted or there's a permission issue.`);
            }
        } else if (item && !item.pdfDataUrl) { // No error with ExportHistoryItemWithUrl type
            alert("PDF preview is only available if it was saved to cloud storage.");
            console.warn(`[History] PDF preview not available for item ${itemId} as no storage path or data URL.`);
        }
    };

    const handleUpdateHistoryStatus = async (itemId: string, status: 'approved' | 'disapproved') => {
        const newHistory = exportHistory.map(item => item.id === itemId ? { ...item, status } : item);
        setExportHistory(newHistory);
        const historyToSave = newHistory.map(item => {
            const { pdfDataUrl, ...rest } = item; // Ensure pdfDataUrl is not saved
            return { ...rest, pdfStoragePath: item.pdfStoragePath || null };
        });
        await persistData({ exportHistory: historyToSave });
        console.log(`[History] Updated status for item ${itemId} to ${status}.`);
    };

    const closeHistoryModal = () => {
        setHistoryModalOpen(false);
        setHistoryPdfDataUrl(null);
        console.log("[History] History modal closed.");
    };

    // Export functions (PDF generation)
    const exportBusinessPlan = async () => {
        const html2canvas = (window as any).html2canvas;
        const jspdfLib = (window as any).jspdf;
        if (!html2canvas || !jspdfLib) { alert("PDF export library not ready."); return; }
        const { jsPDF } = jspdfLib;
        const reportContainer = businessPlanRef.current;
        const reportContainerChinese = businessPlanChineseRef.current;
        if (!reportContainer) return;
        setIsExporting(true);
        console.log("[PDF Export] Starting Business Plan export...");
        const cleanAnimations = (container: HTMLElement) => container.className.replace(/animate-[a-z-]+/g, ' ');
        const originalClassName = reportContainer.className;
        reportContainer.className = cleanAnimations(reportContainer);
        if (reportContainerChinese) reportContainerChinese.className = cleanAnimations(reportContainerChinese);
        try {
            const MARGIN = 40;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const contentWidth = pdfWidth - MARGIN * 2;
            const canvasOptions = { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' }; // Scale reduced to 2, output as JPEG
            const page1 = reportContainer.querySelector<HTMLElement>('#bp-page-1');
            const page2 = reportContainer.querySelector<HTMLElement>('#bp-page-2');
            if (page1) {
                const canvas1 = await html2canvas(page1, canvasOptions);
                const imgData1 = canvas1.toDataURL('image/jpeg', 0.8); // Changed to JPEG, quality 0.8
                const imgHeight1 = (canvas1.height * contentWidth) / canvas1.width;
                pdf.addImage(imgData1, 'JPEG', MARGIN, MARGIN, contentWidth, imgHeight1);
                console.log("[PDF Export] Page 1 (English) added to PDF.");
            }
            if (page2) {
                pdf.addPage();
                const canvas2 = await html2canvas(page2, canvasOptions);
                const imgData2 = canvas2.toDataURL('image/jpeg', 0.8); // Changed to JPEG, quality 0.8
                const imgHeight2 = (canvas2.height * contentWidth) / canvas2.width;
                pdf.addImage(imgData2, 'JPEG', MARGIN, MARGIN, contentWidth, imgHeight2);
                console.log("[PDF Export] Page 2 (English) added to PDF.");
            }
            if (reportContainerChinese && selectedPlan?.aiSummaryChinese && !selectedPlan.aiSummaryChinese.startsWith('Translation failed')) { // Only add Chinese if summary exists and isn't an error
                 const page1_zh = reportContainerChinese.querySelector<HTMLElement>('#bp-page-1');
                 const page2_zh = reportContainerChinese.querySelector<HTMLElement>('#bp-page-2');
                 if (page1_zh) {
                    pdf.addPage();
                    const canvas1_zh = await html2canvas(page1_zh, canvasOptions);
                    const imgData1_zh = canvas1_zh.toDataURL('image/jpeg', 0.8); // Changed to JPEG, quality 0.8
                    const imgHeight1_zh = (canvas1_zh.height * contentWidth) / canvas1_zh.width;
                    pdf.addImage(imgData1_zh, 'JPEG', MARGIN, MARGIN, contentWidth, imgHeight1_zh);
                    console.log("[PDF Export] Page 1 (Chinese) added to PDF.");
                 }
                 if (page2_zh) {
                    pdf.addPage();
                    const canvas2_zh = await html2canvas(page2_zh, canvasOptions);
                    const imgData2_zh = canvas2_zh.toDataURL('image/jpeg', 0.8); // Changed to JPEG, quality 0.8
                    const imgHeight2_zh = (canvas2_zh.height * contentWidth) / canvas2_zh.width;
                    pdf.addImage(imgData2_zh, 'JPEG', MARGIN, MARGIN, contentWidth, imgHeight2_zh);
                    console.log("[PDF Export] Page 2 (Chinese) added to PDF.");
                 }
            }
            const pdfDataUrl = pdf.output('datauristring');
            pdf.save(`Business_Plan_${selectedPlan?.planName}.pdf`);
            await handleAddToHistory('plan', pdfDataUrl);
            console.log("[PDF Export] Business Plan export complete.");
        } catch (error) { 
            console.error("[PDF Export Error] Error exporting Business Plan:", error); 
            alert("Error exporting PDF: " + (error as Error).message);
            setSyncError(`PDF Export failed: ${(error as Error).message}`);
        } finally { setIsExporting(false); reportContainer.className = originalClassName; if(reportContainerChinese) reportContainerChinese.className = originalClassName; }
    };
    
    const exportPurchaseOrder = async () => {
        const html2canvas = (window as any).html2canvas;
        const jspdfLib = (window as any).jspdf;
        if (!html2canvas || !jspdfLib) { alert("PDF library not ready."); return; }
        const { jsPDF } = jspdfLib;
        const input = purchaseOrderRef.current;
        if (!input) return;
        setIsExporting(true);
        console.log("[PDF Export] Starting Purchase Order export...");
        const originalClassName = input.className;
        input.className = originalClassName.replace(/animate-[a-z-]+/g, ' ');
        try {
            const MARGIN = 40; 
            const canvas = await html2canvas(input, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' }); // Scale reduced to 2, output as JPEG
            const imgData = canvas.toDataURL('image/jpeg', 0.8); // Changed to JPEG, quality 0.8
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const contentWidth = pdfWidth - MARGIN * 2;
            const imgHeight = (canvas.height * contentWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', MARGIN, MARGIN, contentWidth, imgHeight);
            const pdfDataUrl = pdf.output('datauristring');
            pdf.save(`PO_${selectedPlan?.planName}_${containerCount}c.pdf`);
            await handleAddToHistory('po', pdfDataUrl);
            console.log("[PDF Export] Purchase Order export complete.");
        } catch (error) { 
            console.error("[PDF Export Error] Error exporting PO:", error); 
            alert("Error exporting PO: " + (error as Error).message);
            setSyncError(`PDF Export failed: ${(error as Error).message}`);
        } finally { setIsExporting(false); input.className = originalClassName; }
    };

    const renderContent = () => {
        if (appView === 'dashboard') {
            return (
                <SavedPlans
                    plans={plans}
                    archivedPlans={archivedPlans}
                    history={exportHistory}
                    onSelectPlan={handleSelectPlan}
                    onArchivePlan={handleArchivePlan}
                    onRestorePlan={handleRestorePlan}
                    onDeletePermanently={handleDeletePermanently}
                    onDuplicatePlan={handleDuplicatePlan}
                    onEditPlan={handleEditPlan}
                    onNewPlan={handleNewPlan}
                    onViewHistoryItem={handleViewHistoryItem}
                    onUpdateHistoryStatus={handleUpdateHistoryStatus}
                    logoUrl={logoUrl} // Pass logoUrl to SavedPlans for potential display/context
                />
            );
        }

        if (appView === 'new_plan') {
            return (
                <DataInputForm 
                    onSave={handleSavePlan}
                    onCancel={() => {
                        setAppView('dashboard');
                        setFormInitialData(undefined);
                    }}
                    initialData={formInitialData}
                    onProductImageUpload={handleProductImageUpload} // Pass the storage upload handler
                />
            );
        }

        if (appView === 'view_plan' && selectedPlan) {
            return (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface p-4 rounded-lg shadow-sm border border-gray-200 gap-4">
                        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
                             <button 
                                onClick={() => handleViewReport('plan')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeReportView === 'plan' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                            >
                                Business Plan
                            </button>
                            <button 
                                onClick={() => handleViewReport('po')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeReportView === 'po' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                            >
                                Purchase Order
                            </button>
                        </div>

                         <div className="flex items-center space-x-4 w-full md:w-auto">
                            {activeReportView === 'po' && (
                                <div className="flex items-center space-x-2 flex-grow md:flex-grow-0">
                                    <label htmlFor="container-count" className="text-sm font-medium text-text-secondary whitespace-nowrap">Containers:</label>
                                    <input 
                                        id="container-count"
                                        type="number" 
                                        min="1" 
                                        value={containerCount} 
                                        onChange={(e) => setContainerCount(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm"
                                    />
                                </div>
                            )}
                            
                            <PDFExportButton 
                                onClick={activeReportView === 'plan' ? exportBusinessPlan : exportPurchaseOrder}
                                isExporting={isExporting}
                                librariesLoaded={pdfLibrariesLoaded}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto pb-8">
                         {activeReportView === 'plan' ? (
                            <>
                                <BusinessPlan 
                                    ref={businessPlanRef}
                                    data={selectedPlan}
                                    logo={logoUrl}
                                    isGeneratingSummary={generatingSummaryForPlanId === selectedPlan.id}
                                    isTranslating={isTranslating}
                                    onRetrySummary={() => handleRetrySummary(selectedPlan.id)}
                                    onTranslateSummary={() => handleTranslateSummary(selectedPlan.id)}
                                />
                                {selectedPlan.aiSummaryChinese && !selectedPlan.aiSummaryChinese.startsWith('Translation failed') && (
                                    <div className="hidden"> {/* This is hidden and only used for PDF export of Chinese summary */}
                                        <BusinessPlan 
                                            ref={businessPlanChineseRef}
                                            data={selectedPlan}
                                            logo={logoUrl}
                                            isGeneratingSummary={false}
                                            isTranslating={false}
                                            onRetrySummary={() => {}}
                                            onTranslateSummary={() => {}}
                                            languageOverride="zh" // Force Chinese language
                                        />
                                    </div>
                                )}
                            </>
                        ) : (
                            <PurchaseOrder 
                                ref={purchaseOrderRef}
                                data={selectedPlan}
                                containerCount={containerCount}
                                logo={logoUrl}
                                poNumber={currentPoNumber}
                            />
                        )}
                    </div>
                </div>
            );
        }

        return null;
    };
    
    // Login Screen
    if (authLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div></div>;
    }

    if (!user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 animate-fade-in">
                <div className="bg-surface p-8 rounded-xl shadow-2xl max-w-md w-full text-center border border-gray-200">
                    <Logo className="h-20 w-20 mx-auto mb-6 animate-float" />
                    <h1 className="text-3xl font-bold text-primary mb-2">Nexstar Planner</h1>
                    <p className="text-text-secondary mb-8">Sign in to manage your business plans securely in the cloud.</p>
                    <button onClick={handleLogin} className="w-full bg-white border border-gray-300 text-text-primary font-bold py-3 px-4 rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center space-x-3 shadow-sm hover:shadow-md">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-6 w-6" />
                        <span>Sign in with Google</span>
                    </button>
                    <div className="mt-8 text-xs text-text-secondary">
                        <p>App Version: {APP_VERSION}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Main App
    return (
        <div className="bg-background min-h-screen font-sans text-text-primary">
            {syncError && (
                <div className="bg-danger text-white text-center py-2 px-4 text-sm font-bold shadow-md break-words">
                    ⚠️ {syncError}
                    <button onClick={() => setSyncError(null)} className="ml-4 text-white text-opacity-80 hover:text-opacity-100 font-normal underline">Dismiss</button>
                </div>
            )}
            <header className="bg-surface/80 backdrop-blur-sm shadow-sm sticky top-0 z-10 border-b border-gray-200">
                <div className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-4">
                             <Logo className="h-10 w-10" />
                             <label htmlFor="logo-upload" className="cursor-pointer text-text-secondary hover:text-primary transition-colors group relative" title="Upload Company Logo">
                                {logoUrl ? <img src={logoUrl} alt="Logo" className="h-10 w-10 bg-gray-100 p-1 rounded-md object-contain"/> : <div className="h-10 w-10 bg-secondary rounded-md flex items-center justify-center text-primary"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></div>}
                                <input id="logo-upload" type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                             </label>
                        </div>
                        <h1 className="text-xl font-semibold text-text-primary hidden sm:block">Nexstar Planner</h1>
                    </div>
                     <div className="flex items-center space-x-4">
                        {appView !== 'dashboard' && (
                            <button onClick={() => { setAppView('dashboard'); setFormInitialData(undefined); }} className="text-text-secondary hover:bg-secondary p-2 rounded-full text-sm font-medium transition-colors hover:text-primary" aria-label="Back to dashboard">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" /></svg>
                            </button>
                        )}
                        <div className="h-8 w-px bg-gray-200 mx-2"></div>
                        <div className="flex items-center space-x-3">
                            <span className="text-sm font-medium hidden md:block text-text-secondary">{user.displayName || user.email}</span>
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="Profile" className="h-8 w-8 rounded-full border border-gray-300" />
                            ) : (
                                <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">{user.email?.charAt(0).toUpperCase()}</div>
                            )}
                            <button onClick={signOut} className="text-xs text-danger hover:underline font-medium">Sign Out</button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-8">
                {renderContent()}
            </main>

            <footer className="text-center py-4 text-xs text-text-secondary">
                <p>{APP_VERSION}</p>
            </footer>

            {historyModalOpen && historyPdfDataUrl && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-5xl flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
                            <h3 className="text-lg font-bold text-text-primary">PDF Preview</h3>
                            <button onClick={closeHistoryModal} className="text-gray-400 hover:text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-full h-8 w-8 flex items-center justify-center transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-grow bg-gray-200">
                            <iframe src={historyPdfDataUrl} className="w-full h-full border-none" title="PDF Preview"></iframe>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;