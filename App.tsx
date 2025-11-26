
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
import type { BusinessPlanData, ViewType, AppView, ExportHistoryItem } from './types';
import type { User } from 'firebase/auth';

const APP_VERSION = "v2.2"; // Updated version to confirm deployment with Storage integration

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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
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
    const [logoStoragePath, setLogoStoragePath] = useState<string | undefined>(undefined); // Stores path in Storage
    const [formInitialData, setFormInitialData] = useState<BusinessPlanData | undefined>(undefined);
    const [currentPoNumber, setCurrentPoNumber] = useState('');
    const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
    
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
                // User is logged in. Check for migration and subscribe to data.
                
                // MIGRATION CHECK:
                const cloudData = await getUserDataOnce(currentUser.uid);
                const localDataString = localStorage.getItem('nexstar_data');
                
                if (!cloudData && localDataString) {
                    try {
                        const localData = JSON.parse(localDataString);
                        console.log("Migrating local data to cloud...");

                        // Handle logo migration (if present in local storage)
                        let migratedLogoStoragePath: string | null = null;
                        if (localData.logo && currentUser) {
                            // If localData.logo is base64, upload it
                            if (localData.logo.startsWith('data:image')) {
                                const logoBlob = await (await fetch(localData.logo)).blob();
                                migratedLogoStoragePath = `users/${currentUser.uid}/logos/user_logo_${new Date().getTime()}`;
                                await uploadFileToStorage(currentUser.uid, logoBlob, migratedLogoStoragePath);
                            } else {
                                migratedLogoStoragePath = localData.logo; // Assume it's already a Storage path/URL
                            }
                        }

                        // Adjust plans and product images if they are base64
                        const migratePlans = async (plansToMigrate: BusinessPlanData[]) => {
                            return Promise.all(plansToMigrate.map(async plan => {
                                const productsWithMigratedImages = await Promise.all(plan.products.map(async product => {
                                    if (product.productImage && product.productImage.startsWith('data:image')) {
                                        const imageBlob = await (await fetch(product.productImage)).blob();
                                        const storagePath = `users/${currentUser.uid}/product_images/${product.id}_${new Date().getTime()}`;
                                        const imageUrl = await uploadFileToStorage(currentUser.uid, imageBlob, storagePath);
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
                                const pdfBlob = await (await fetch(item.pdfDataUrl)).blob();
                                const storagePath = `users/${currentUser.uid}/pdf_exports/${item.id}_${new Date().getTime()}.pdf`;
                                await uploadFileToStorage(currentUser.uid, pdfBlob, storagePath);
                                const { pdfDataUrl, ...rest } = item;
                                return { ...rest, pdfStoragePath: storagePath };
                            }
                            const { pdfDataUrl, ...rest } = item; // Ensure pdfDataUrl is NOT stored directly in Firestore document
                            return rest;
                        }));

                        await saveUserData(currentUser.uid, {
                            plans: migratedPlans,
                            archivedPlans: migratedArchivedPlans,
                            logoStoragePath: migratedLogoStoragePath, // Store path from Storage
                            poCounter: localData.poCounter || 1,
                            exportHistory: migratedExportHistory
                        });
                        localStorage.removeItem('nexstar_data'); // Clear local data after successful migration
                    } catch (e) {
                        console.error("Migration failed", e);
                        setSyncError(`Failed to migrate local data to cloud: ${String(e)}`);
                    }
                }

                // SUBSCRIBE TO FIRESTORE
                const unsubscribeFirestore = onUserDataSnapshot(currentUser.uid, async (data) => {
                    if (data) {
                        // Retrieve logo URL from Storage if path exists
                        if (data.logoStoragePath) {
                            const url = await getDownloadURLFromStoragePath(data.logoStoragePath);
                            setLogoUrl(url);
                            setLogoStoragePath(data.logoStoragePath);
                        } else {
                            setLogoUrl('');
                            setLogoStoragePath(undefined);
                        }

                        // Pre-fetch product image URLs for plans
                        const plansWithImages = await Promise.all((data.plans || []).map(async plan => {
                            const productsWithImages = await Promise.all(plan.products.map(async product => {
                                if (product.productImage && !product.productImage.startsWith('http')) { // If it's a storage path
                                    try {
                                        const url = await getDownloadURLFromStoragePath(product.productImage);
                                        return { ...product, productImage: url };
                                    } catch (e) {
                                        console.warn(`Could not get download URL for ${product.productImage} for plan ${plan.id}:`, e);
                                        return { ...product, productImage: '' }; // Fallback to empty if URL fails
                                    }
                                }
                                return product;
                            }));
                            return { ...plan, products: productsWithImages };
                        }));
                        setPlans(plansWithImages);

                        const archivedPlansWithImages = await Promise.all((data.archivedPlans || []).map(async plan => {
                            const productsWithImages = await Promise.all(plan.products.map(async product => {
                                if (product.productImage && !product.productImage.startsWith('http')) { // If it's a storage path
                                    try {
                                        const url = await getDownloadURLFromStoragePath(product.productImage);
                                        return { ...product, productImage: url };
                                    } catch (e) {
                                        console.warn(`Could not get download URL for archived ${product.productImage} for plan ${plan.id}:`, e);
                                        return { ...product, productImage: '' }; // Fallback to empty if URL fails
                                    }
                                }
                                return product;
                            }));
                            return { ...plan, products: productsWithImages };
                        }));
                        setArchivedPlans(archivedPlansWithImages);

                        setPoCounter(data.poCounter || 1);
                        // Fetch PDF URLs for export history
                        const historyWithUrls = await Promise.all((data.exportHistory || []).map(async item => {
                            if (item.pdfStoragePath) {
                                try {
                                    const url = await getDownloadURLFromStoragePath(item.pdfStoragePath);
                                    return { ...item, pdfDataUrl: url }; // Store public URL for display
                                } catch (e) {
                                    console.warn(`Could not get download URL for PDF history item ${item.id}:`, e);
                                    return { ...item, pdfDataUrl: null }; // Fallback
                                }
                            }
                            return item;
                        }));
                        setExportHistory(historyWithUrls);

                    } else {
                        // New user with no data
                        setPlans([]);
                        setArchivedPlans([]);
                        setLogoUrl('');
                        setLogoStoragePath(undefined);
                        setPoCounter(1);
                        setExportHistory([]);
                    }
                });
                
                setAuthLoading(false);
                return () => unsubscribeFirestore();
            } else {
                // User is logged out.
                setPlans([]);
                setArchivedPlans([]);
                setLogoUrl('');
                setLogoStoragePath(undefined);
                setAuthLoading(false);
            }
        });

        // Load PDF Libs
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
        ]).then(() => setPdfLibrariesLoaded(true))
        .catch(error => {
            console.error("Failed to load PDF libraries:", error);
            setSyncError("Failed to load PDF export libraries. Please check your internet connection.");
        });

        return () => unsubscribeAuth();
    }, [user?.uid]); // Re-run effect if user UID changes for proper subscription/migration

    // Helper to persist data to Firestore if logged in
    const persistData = async (updates: Partial<UserData>) => {
        if (user) {
            try {
                await saveUserData(user.uid, updates);
                setSyncError(null);
            } catch (error: any) {
                console.error("Sync Error:", error);
                if (error.code === 'permission-denied') {
                    setSyncError("Permission Denied: Please update your Firestore Database Rules in Firebase Console to allow writes.");
                } else if (error.code === 'resource-exhausted') {
                    setSyncError(`Failed to save: Document size exceeds 1MB limit. Remove large images or PDFs. Error: ${error.message}`);
                }
                else {
                    // Display the actual error message to help debugging
                    setSyncError(`Failed to save: ${error.message || 'Unknown error'}`);
                }
            }
        } else {
            console.warn("User not logged in, cannot save data.");
            setSyncError("Not logged in. Data not saved to cloud.");
        }
    };

    const handleLogin = async () => {
        try {
            await signInWithGoogle();
        } catch (error: any) {
            console.error("Login error:", error);
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
        }
    };

    const handleSavePlan = async (planData: Omit<BusinessPlanData, 'id' | 'aiSummary' | 'createdAt' | 'updatedAt'>) => {
        if (!user) {
            alert("Please sign in to save plans.");
            return;
        }
        
        setGeneratingSummaryForPlanId('new');
        const summary = await generateBusinessPlanSummary(planData as BusinessPlanData);
        setGeneratingSummaryForPlanId(null);
        
        const existingPlan = plans.find(p => p.id === formInitialData?.id);
        let updatedPlans: BusinessPlanData[];
        let planToSave: BusinessPlanData;
        
        // Use null instead of undefined for Firestore compatibility
        if (existingPlan) {
             planToSave = { ...existingPlan, ...planData, aiSummary: summary, aiSummaryChinese: null, updatedAt: new Date().toISOString() };
             updatedPlans = plans.map(p => p.id === existingPlan.id ? planToSave : p);
        } else {
             planToSave = { ...planData, id: new Date().toISOString(), aiSummary: summary, aiSummaryChinese: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
             updatedPlans = [...plans, planToSave];
        }
        
        setPlans(updatedPlans); // Optimistic update
        await persistData({ plans: updatedPlans });
        setAppView('dashboard');
        setFormInitialData(undefined);
    };
    
    const handleRetrySummary = async (planId: string) => {
        const planToUpdate = plans.find(p => p.id === planId);
        if (!planToUpdate) return;

        setGeneratingSummaryForPlanId(planId);
        const newSummary = await generateBusinessPlanSummary(planToUpdate);
        setGeneratingSummaryForPlanId(null);

        // Use null instead of undefined
        const updatedPlan = { ...planToUpdate, aiSummary: newSummary, aiSummaryChinese: null, updatedAt: new Date().toISOString() };
        const updatedPlans = plans.map(p => p.id === planId ? updatedPlan : p);
        
        setPlans(updatedPlans);
        await persistData({ plans: updatedPlans });
        if (selectedPlan?.id === planId) {
            setSelectedPlan(updatedPlan);
        }
    };

    const handleTranslateSummary = async (planId: string) => {
        const planToUpdate = plans.find(p => p.id === planId);
        if (!planToUpdate || !planToUpdate.aiSummary || planToUpdate.aiSummary.startsWith('Failed')) return;
        
        setIsTranslating(true);
        const translation = await translateTextToChinese(planToUpdate.aiSummary);
        setIsTranslating(false);

        const updatedPlan = { ...planToUpdate, aiSummaryChinese: translation, updatedAt: new Date().toISOString() };
        const updatedPlans = plans.map(p => p.id === planId ? updatedPlan : p);

        setPlans(updatedPlans);
        await persistData({ plans: updatedPlans });
        if (selectedPlan?.id === planId) {
            setSelectedPlan(updatedPlan);
        }
    };

    const handleSelectPlan = (planId: string) => {
        const plan = plans.find(p => p.id === planId);
        if (plan) {
            setSelectedPlan(plan);
            setContainerCount(1);
            setActiveReportView('plan');
            setCurrentPoNumber('');
            setAppView('view_plan');
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
        }
    };

    const handleDeletePermanently = async (planId: string) => {
        if (!user) {
            alert("You must be signed in to delete files from cloud storage permanently.");
            return;
        }
        if (!window.confirm("This action is permanent and cannot be undone. Are you sure you want to delete this plan forever? All associated images and PDFs will also be deleted from storage.")) return;
        
        const planToDelete = archivedPlans.find(p => p.id === planId);
        if (planToDelete) {
            // Delete associated images from Storage
            for (const product of planToDelete.products) {
                if (product.productImage && !product.productImage.startsWith('http')) { // Check if it's a storage path
                    await deleteFileFromStorage(product.productImage); // Delete using path
                }
            }
            
            // Delete associated PDFs from Storage
            const historyItemsToDelete = exportHistory.filter(item => item.planModel === planToDelete.planName && item.pdfStoragePath);
            for (const item of historyItemsToDelete) {
                if (item.pdfStoragePath) {
                    await deleteFileFromStorage(item.pdfStoragePath); // Delete using path
                }
            }
        }

        const newArchivedPlans = archivedPlans.filter(p => p.id !== planId);
        setArchivedPlans(newArchivedPlans);
        await persistData({ archivedPlans: newArchivedPlans });
    };
    
    const handleEditPlan = (planId: string) => {
        const planToEdit = plans.find(p => p.id === planId);
        if (planToEdit) {
            setFormInitialData(planToEdit);
            setAppView('new_plan');
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
        }
    };
    
    const handleNewPlan = () => {
        setFormInitialData(undefined);
        setAppView('new_plan');
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!user) {
            alert("Please sign in to upload a logo to cloud storage.");
            return;
        }
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const storagePath = `users/${user.uid}/logos/user_logo_${file.name}_${new Date().getTime()}`; // Unique path for logo
            try {
                const downloadUrl = await uploadFileToStorage(user.uid, file, storagePath);
                setLogoUrl(downloadUrl); // Store URL
                setLogoStoragePath(storagePath); // Update the path state
                await persistData({ logoStoragePath: storagePath }); // Store path in Firestore
            } catch (error) {
                console.error("Error uploading logo:", error);
                alert("Failed to upload logo. Please try again.");
            }
        }
    };
    
    // This handler will be passed to DataInputForm for product image uploads
    const handleProductImageUpload = async (productId: string, file: File): Promise<string> => {
        if (!user) {
            throw new Error("User not signed in. Cannot upload product image.");
        }
        const storagePath = `users/${user.uid}/product_images/${productId}_${file.name}_${new Date().getTime()}`;
        const downloadUrl = await uploadFileToStorage(user.uid, file, storagePath);
        return downloadUrl; // Return the URL to be stored in product data
    };


    const handleViewReport = (view: ViewType) => {
        if (view === 'po' && activeReportView !== 'po') {
            const nextPoCounter = poCounter + 1;
            const number = `PO-${new Date().getFullYear()}-${String(poCounter).padStart(4, '0')}`;
            setCurrentPoNumber(number);
            setPoCounter(nextPoCounter);
            persistData({ poCounter: nextPoCounter });
        }
        setActiveReportView(view);
    };

    const handleAddToHistory = async (type: ViewType, pdfDataUrl: string) => {
        if (!user || !selectedPlan) return;
        
        const storagePath = `users/${user.uid}/pdf_exports/${selectedPlan.id}_${type}_${new Date().getTime()}.pdf`;
        try {
            const fileBlob = await fetch(pdfDataUrl).then(res => res.blob());
            await uploadFileToStorage(user.uid, fileBlob, storagePath); // Upload PDF to storage
            // No need to get download URL here, just store the path

            const newItem: ExportHistoryItem = {
                id: `${new Date().toISOString()}-${Math.random()}`,
                type,
                planModel: selectedPlan.planName,
                exportedAt: new Date().toISOString(),
                status: 'pending',
                pdfStoragePath: storagePath, // Store path to Storage
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

        } catch (error) {
            console.error("Error adding to history/uploading PDF:", error);
            alert("Failed to save PDF to history. Check console for details.");
        }
    };

    const handleViewHistoryItem = async (itemId: string) => {
        const item = exportHistory.find(h => h.id === itemId);
        if (item && item.pdfStoragePath && user) {
            try {
                const url = await getDownloadURLFromStoragePath(item.pdfStoragePath);
                setHistoryPdfDataUrl(url); // Now this is a public download URL
                setHistoryModalOpen(true);
            } catch (error) {
                console.error("Error retrieving PDF from storage:", error);
                alert("Failed to retrieve PDF. It might have been deleted or there's a permission issue.");
            }
        } else if (item && !item.pdfStoragePath) {
            alert("PDF preview is only available if it was saved to cloud storage.");
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
    };

    const closeHistoryModal = () => {
        setHistoryModalOpen(false);
        setHistoryPdfDataUrl(null);
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
        const cleanAnimations = (container: HTMLElement) => container.className.replace(/animate-[a-z-]+/g, ' ');
        const originalClassName = reportContainer.className;
        reportContainer.className = cleanAnimations(reportContainer);
        if (reportContainerChinese) reportContainerChinese.className = cleanAnimations(reportContainerChinese);
        try {
            const MARGIN = 40;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const contentWidth = pdfWidth - MARGIN * 2;
            const canvasOptions = { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff' };
            const page1 = reportContainer.querySelector<HTMLElement>('#bp-page-1');
            const page2 = reportContainer.querySelector<HTMLElement>('#bp-page-2');
            if (page1) {
                const canvas1 = await html2canvas(page1, canvasOptions);
                const imgData1 = canvas1.toDataURL('image/png', 1.0);
                const imgHeight1 = (canvas1.height * contentWidth) / canvas1.width;
                pdf.addImage(imgData1, 'PNG', MARGIN, MARGIN, contentWidth, imgHeight1);
            }
            if (page2) {
                pdf.addPage();
                const canvas2 = await html2canvas(page2, canvasOptions);
                const imgData2 = canvas2.toDataURL('image/png', 1.0);
                const imgHeight2 = (canvas2.height * contentWidth) / canvas2.width;
                pdf.addImage(imgData2, 'PNG', MARGIN, MARGIN, contentWidth, imgHeight2);
            }
            if (reportContainerChinese && selectedPlan?.aiSummaryChinese && !selectedPlan.aiSummaryChinese.startsWith('Translation failed')) { // Only add Chinese if summary exists and isn't an error
                 const page1_zh = reportContainerChinese.querySelector<HTMLElement>('#bp-page-1');
                 const page2_zh = reportContainerChinese.querySelector<HTMLElement>('#bp-page-2');
                 if (page1_zh) {
                    pdf.addPage();
                    const canvas1_zh = await html2canvas(page1_zh, canvasOptions);
                    const imgData1_zh = canvas1_zh.toDataURL('image/png', 1.0);
                    const imgHeight1_zh = (canvas1_zh.height * contentWidth) / canvas1_zh.width;
                    pdf.addImage(imgData1_zh, 'PNG', MARGIN, MARGIN, contentWidth, imgHeight1_zh);
                 }
                 if (page2_zh) {
                    pdf.addPage();
                    const canvas2_zh = await html2canvas(page2_zh, canvasOptions);
                    const imgData2_zh = canvas2_zh.toDataURL('image/png', 1.0);
                    const imgHeight2_zh = (canvas2_zh.height * contentWidth) / canvas2_zh.width;
                    pdf.addImage(imgData2_zh, 'PNG', MARGIN, MARGIN, contentWidth, imgHeight2_zh);
                 }
            }
            const pdfDataUrl = pdf.output('datauristring');
            pdf.save(`Business_Plan_${selectedPlan?.planName}.pdf`);
            await handleAddToHistory('plan', pdfDataUrl);
        } catch (error) { console.error("Error exporting Business Plan:", error); alert("Error exporting PDF: " + (error as Error).message);
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
        const originalClassName = input.className;
        input.className = originalClassName.replace(/animate-[a-z-]+/g, ' ');
        try {
            const MARGIN = 40; 
            const canvas = await html2canvas(input, { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png', 1.0);
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const contentWidth = pdfWidth - MARGIN * 2;
            const imgHeight = (canvas.height * contentWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', MARGIN, MARGIN, contentWidth, imgHeight);
            const pdfDataUrl = pdf.output('datauristring');
            pdf.save(`PO_${selectedPlan?.planName}_${containerCount}c.pdf`);
            await handleAddToHistory('po', pdfDataUrl);
        } catch (error) { console.error("Error exporting PO:", error); alert("Error exporting PO: " + (error as Error).message);
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
                <div className="bg-red-500 text-white text-center py-2 px-4 text-sm font-bold shadow-md break-words">
                    ⚠️ {syncError}
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