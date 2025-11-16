import React, { useState, useRef, useCallback, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import BusinessPlan from './components/BusinessPlan';
import PurchaseOrder from './components/PurchaseOrder';
import DataInputForm from './components/DataInputForm';
import SavedPlans from './components/SavedPlans';
import Logo from './components/Logo';
import { generateBusinessPlanSummary, translateTextToChinese, parseBusinessPlanFromText } from './services/geminiService';
import { onUserDataSnapshot, saveUserData, signInWithGoogle, signOut, UserData, getRedirectResult } from './services/firestoreService';
import { auth } from './services/firebaseConfig';
import type { BusinessPlanData, ViewType, AppView, ExportHistoryItem } from './types';

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
    const [user, setUser] = useState<firebase.User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [plans, setPlans] = useState<BusinessPlanData[]>([]);
    const [archivedPlans, setArchivedPlans] = useState<BusinessPlanData[]>([]);
    const [appView, setAppView] = useState<AppView>('dashboard');
    const [selectedPlan, setSelectedPlan] = useState<BusinessPlanData | null>(null);
    const [activeReportView, setActiveReportView] = useState<ViewType>('plan');
    const [containerCount, setContainerCount] = useState(1);
    const [poCounter, setPoCounter] = useState(1);
    const [logo, setLogo] = useState('');
    const [formInitialData, setFormInitialData] = useState<BusinessPlanData | undefined>(undefined);
    const [currentPoNumber, setCurrentPoNumber] = useState('');
    const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    const [isImportingPdf, setIsImportingPdf] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyPdfUrl, setHistoryPdfUrl] = useState<string | null>(null);
    const [pdfLibrariesLoaded, setPdfLibrariesLoaded] = useState(false);
    const [generatingSummaryForPlanId, setGeneratingSummaryForPlanId] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    
    const businessPlanRef = useRef<HTMLDivElement>(null);
    const businessPlanChineseRef = useRef<HTMLDivElement>(null);
    const purchaseOrderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Load PDF libraries dynamically
        const loadScript = (src: string): Promise<void> => {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) {
                    return resolve();
                }
                const script = document.createElement('script');
                script.src = src;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error(`Failed to load script ${src}`));
                document.head.appendChild(script);
            });
        };

        Promise.all([
            loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"),
            loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"),
            loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js")
        ]).then(() => {
            // @ts-ignore
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            setPdfLibrariesLoaded(true);
        }).catch(error => {
            console.error("PDF libraries failed to load:", error);
            alert("Could not load PDF generation libraries. Exporting and Importing will be disabled. Please check your network connection or ad-blocker settings.");
        });
    }, []);

    // Effect for handling Firebase Authentication state
    useEffect(() => {
        // This listener handles all auth state changes, including after a redirect.
        const unsubscribeAuth = auth.onAuthStateChanged(firebaseUser => {
            setUser(firebaseUser);
            setIsLoading(false); // Auth state is known, stop loading spinner.
        });
    
        // Check for redirect result on initial load.
        // onAuthStateChanged will still fire with the user if this is successful.
        getRedirectResult().catch(error => {
            console.error("Error processing sign-in redirect:", error);
            if (error.code === 'auth/account-exists-with-different-credential') {
                alert("An account with this email already exists with a different credential.");
            }
        });

        return () => unsubscribeAuth(); // Cleanup auth listener on unmount
    }, []);

    // Effect for loading user data from Firestore when user is logged in
    useEffect(() => {
        if (user) {
            setIsLoading(true); // Start loading user data
            const unsubscribeData = onUserDataSnapshot(user.uid, (data) => {
                if (data) {
                    setPlans(data.plans || []);
                    setArchivedPlans(data.archivedPlans || []);
                    setLogo(data.logo || '');
                    setPoCounter(data.poCounter || 1);
                    setExportHistory(data.exportHistory || []);
                } else {
                    // New user, set defaults
                    setPlans([]);
                    setArchivedPlans([]);
                    setLogo('');
                    setPoCounter(1);
                    setExportHistory([]);
                }
                setIsLoading(false); // Data loaded, stop loading
            });

            return () => unsubscribeData(); // Cleanup data listener when user changes
        } else {
            // User is null, clear all data
            setPlans([]);
            setArchivedPlans([]);
            setLogo('');
            setPoCounter(1);
            setExportHistory([]);
            setAppView('dashboard');
            setSelectedPlan(null);
        }
    }, [user]); // Dependency on `user` ensures this runs when user logs in or out

    const saveDataToFirestore = useCallback(async (data: Partial<UserData>) => {
        if (!user) return;
        try {
            await saveUserData(user.uid, data);
        } catch (error) {
            alert('Failed to save data to the cloud. Please check your connection and try again.');
        }
    }, [user]);

    const handleSavePlan = async (planData: Omit<BusinessPlanData, 'id' | 'aiSummary' | 'createdAt' | 'updatedAt'>) => {
        setGeneratingSummaryForPlanId('new');
        const summary = await generateBusinessPlanSummary(planData as BusinessPlanData);
        setGeneratingSummaryForPlanId(null);
        
        const existingPlan = plans.find(p => p.id === formInitialData?.id);
        let updatedPlans;
        
        if (existingPlan) {
             const updatedPlan = { ...existingPlan, ...planData, aiSummary: summary, aiSummaryChinese: undefined, updatedAt: new Date().toISOString() };
             updatedPlans = plans.map(p => p.id === existingPlan.id ? updatedPlan : p);
        } else {
             const newPlan = { ...planData, id: new Date().toISOString(), aiSummary: summary, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
             updatedPlans = [...plans, newPlan];
        }
        
        setPlans(updatedPlans);
        await saveDataToFirestore({ plans: updatedPlans });
        setAppView('dashboard');
        setFormInitialData(undefined);
    };
    
    const handleImportFromPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // @ts-ignore
        const pdfjsLib = window.pdfjsLib;
        if (!pdfjsLib) {
            alert("PDF library is not loaded yet. Please wait a moment.");
            return;
        }

        setIsImportingPdf(true);
        try {
            const fileReader = new FileReader();
            fileReader.onload = async (event) => {
                if (!event.target?.result) return;
                const typedarray = new Uint8Array(event.target.result as ArrayBuffer);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = '';

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    fullText += pageText + '\n\n';
                }

                const parsedJson = await parseBusinessPlanFromText(fullText);
                const parsedData = JSON.parse(parsedJson);

                if (!parsedData.planName || !parsedData.products) {
                    throw new Error("AI could not extract the required fields from the PDF.");
                }

                // Add missing fields and save
                await handleSavePlan(parsedData);
                alert(`Successfully imported plan: "${parsedData.planName}"`);
            };
            fileReader.readAsArrayBuffer(file);
        } catch (error) {
            console.error("Error importing from PDF:", error);
            alert(`Failed to import from PDF. ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsImportingPdf(false);
             // Reset file input value to allow re-uploading the same file
            e.target.value = '';
        }
    };


    const handleRetrySummary = async (planId: string) => {
        const planToUpdate = plans.find(p => p.id === planId);
        if (!planToUpdate) return;

        setGeneratingSummaryForPlanId(planId);
        const newSummary = await generateBusinessPlanSummary(planToUpdate);
        setGeneratingSummaryForPlanId(null);

        const updatedPlan = { ...planToUpdate, aiSummary: newSummary, aiSummaryChinese: undefined, updatedAt: new Date().toISOString() };
        const updatedPlans = plans.map(p => p.id === planId ? updatedPlan : p);
        
        setPlans(updatedPlans);
        await saveDataToFirestore({ plans: updatedPlans });
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
        await saveDataToFirestore({ plans: updatedPlans });
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
            await saveDataToFirestore({ plans: newPlans, archivedPlans: newArchivedPlans });
        }
    };
    
    const handleRestorePlan = async (planId: string) => {
        const planToRestore = archivedPlans.find(p => p.id === planId);
        if (planToRestore) {
            const newArchivedPlans = archivedPlans.filter(p => p.id !== planId);
            const newPlans = [planToRestore, ...plans];
            setArchivedPlans(newArchivedPlans);
            setPlans(newPlans);
            await saveDataToFirestore({ plans: newPlans, archivedPlans: newArchivedPlans });
        }
    };

    const handleDeletePermanently = async (planId: string) => {
        if (!window.confirm("This action is permanent and cannot be undone. Are you sure you want to delete this plan forever?")) return;
        const newArchivedPlans = archivedPlans.filter(p => p.id !== planId);
        setArchivedPlans(newArchivedPlans);
        await saveDataToFirestore({ archivedPlans: newArchivedPlans });
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
            const duplicatedData = { ...planToDuplicate, id: '', planName: `${planToDuplicate.planName} (Copy)` };
            setFormInitialData(duplicatedData);
            setAppView('new_plan');
        }
    };
    
    const handleNewPlan = () => {
        setFormInitialData(undefined);
        setAppView('new_plan');
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            setLogo(base64);
            await saveDataToFirestore({ logo: base64 });
        }
    };

    const handleViewReport = (view: ViewType) => {
        if (view === 'po' && activeReportView !== 'po') {
            const nextPoCounter = poCounter + 1;
            const number = `PO-${new Date().getFullYear()}-${String(poCounter).padStart(4, '0')}`;
            setCurrentPoNumber(number);
            setPoCounter(nextPoCounter);
            saveDataToFirestore({ poCounter: nextPoCounter });
        }
        setActiveReportView(view);
    };

    const handleAddToHistory = async (type: ViewType, pdfDataUrl: string) => {
        if (!selectedPlan) return;
        
        const newItem: ExportHistoryItem = {
            id: `${new Date().toISOString()}-${Math.random()}`,
            type,
            planModel: selectedPlan.planName,
            exportedAt: new Date().toISOString(),
            status: 'pending',
            pdfDataUrl: pdfDataUrl,
        };

        if (type === 'po') {
            newItem.poNumber = currentPoNumber;
            newItem.containerCount = containerCount;
        }

        const newHistory = [newItem, ...exportHistory];
        setExportHistory(newHistory);
        
        const historyToSave = newHistory.map(item => {
            const { pdfDataUrl, ...rest } = item;
            return rest;
        });
        await saveDataToFirestore({ exportHistory: historyToSave });
    };

    const handleViewHistoryItem = (itemId: string) => {
        const item = exportHistory.find(h => h.id === itemId);
        if (item && item.pdfDataUrl) {
            setHistoryPdfUrl(item.pdfDataUrl);
            setHistoryModalOpen(true);
        }
    };

    const handleUpdateHistoryStatus = async (itemId: string, status: 'approved' | 'disapproved') => {
        const newHistory = exportHistory.map(item => item.id === itemId ? { ...item, status } : item);
        setExportHistory(newHistory);
        const historyToSave = newHistory.map(item => {
            const { pdfDataUrl, ...rest } = item;
            return rest;
        });
        await saveDataToFirestore({ exportHistory: historyToSave });
    };

    const closeHistoryModal = () => {
        setHistoryModalOpen(false);
        setHistoryPdfUrl(null);
    };

    const exportBusinessPlan = async () => {
        // @ts-ignore
        const html2canvas = window.html2canvas;
        // @ts-ignore
        const { jsPDF } = window.jspdf;

        if (!html2canvas || !jsPDF) { alert("PDF export library not ready. Please wait a moment and try again."); return; }
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

            if (!page1 || !page2) { alert('Could not find English page elements for PDF export.'); setIsExporting(false); return; }

            const canvas1 = await html2canvas(page1, canvasOptions);
            const imgData1 = canvas1.toDataURL('image/png', 1.0);
            const imgHeight1 = (canvas1.height * contentWidth) / canvas1.width;
            pdf.addImage(imgData1, 'PNG', MARGIN, MARGIN, contentWidth, imgHeight1);

            pdf.addPage();
            const canvas2 = await html2canvas(page2, canvasOptions);
            const imgData2 = canvas2.toDataURL('image/png', 1.0);
            const imgHeight2 = (canvas2.height * contentWidth) / canvas2.width;
            pdf.addImage(imgData2, 'PNG', MARGIN, MARGIN, contentWidth, imgHeight2);

            if (reportContainerChinese) {
                const page1_zh = reportContainerChinese.querySelector<HTMLElement>('#bp-page-1');
                const page2_zh = reportContainerChinese.querySelector<HTMLElement>('#bp-page-2');
                if (page1_zh && page2_zh) {
                    pdf.addPage();
                    const canvas1_zh = await html2canvas(page1_zh, canvasOptions);
                    const imgData1_zh = canvas1_zh.toDataURL('image/png', 1.0);
                    const imgHeight1_zh = (canvas1_zh.height * contentWidth) / canvas1_zh.width;
                    pdf.addImage(imgData1_zh, 'PNG', MARGIN, MARGIN, contentWidth, imgHeight1_zh);

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
        } catch (error) { console.error("Error exporting Business Plan:", error); alert("An error occurred while exporting the Business Plan.");
        } finally {
            setIsExporting(false);
            if (reportContainer) reportContainer.className = originalClassName;
            if (reportContainerChinese) reportContainerChinese.className = originalClassName;
        }
    };
    
    const exportPurchaseOrder = async () => {
        // @ts-ignore
        const html2canvas = window.html2canvas;
        // @ts-ignore
        const { jsPDF } = window.jspdf;
        if (!html2canvas || !jsPDF) { alert("PDF export library not ready. Please wait a moment and try again."); return; }
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
        } catch (error) { console.error("Error exporting Purchase Order:", error); alert("An error occurred while exporting the Purchase Order.");
        } finally {
            setIsExporting(false);
            if (input) input.className = originalClassName;
        }
    };

    const handleExportData = () => { /* This function can be removed or adapted for Firestore if needed */ };
    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => { /* This function can be removed or adapted for Firestore if needed */ };
    
    const renderContent = () => {
        switch(appView) {
            case 'dashboard':
                return <SavedPlans plans={plans} archivedPlans={archivedPlans} history={exportHistory} onSelectPlan={handleSelectPlan} onArchivePlan={handleArchivePlan} onRestorePlan={handleRestorePlan} onDeletePermanently={handleDeletePermanently} onDuplicatePlan={handleDuplicatePlan} onEditPlan={handleEditPlan} onNewPlan={handleNewPlan} onViewHistoryItem={handleViewHistoryItem} onUpdateHistoryStatus={handleUpdateHistoryStatus} onExportData={handleExportData} onImportData={handleImportData} onImportFromPdf={handleImportFromPdf} isImportingPdf={isImportingPdf} pdfLibrariesLoaded={pdfLibrariesLoaded} />;
            case 'new_plan':
                return <DataInputForm onSave={handleSavePlan} onCancel={() => setAppView('dashboard')} initialData={formInitialData} />;
            case 'view_plan':
                if (!selectedPlan) return <p>No plan selected.</p>;
                return (
                    <div className="animate-fade-in">
                        <div className="bg-surface p-4 rounded-lg shadow-md mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-gray-200">
                            <div>
                                <h2 className="text-2xl font-bold text-text-primary">Viewing: <span className="text-primary">{selectedPlan.planName}</span></h2>
                                <p className="text-text-secondary">Select a report view below to generate or export.</p>
                            </div>
                             <div className="bg-secondary p-1 rounded-lg flex space-x-1 self-stretch sm:self-center">
                                {(['plan', 'po'] as ViewType[]).map(view => (
                                     <button key={view} onClick={() => handleViewReport(view)} className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-300 w-full sm:w-auto ${activeReportView === view ? 'bg-primary text-white shadow' : 'text-text-primary hover:bg-white/60'}`}>
                                        {view === 'plan' ? 'Business Plan' : 'Purchase Order'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {activeReportView === 'plan' ? (
                            <div>
                                <div className="flex justify-end mb-4 space-x-2">
                                    <PDFExportButton onClick={exportBusinessPlan} isExporting={isExporting} librariesLoaded={pdfLibrariesLoaded} />
                                </div>
                                <BusinessPlan ref={businessPlanRef} data={selectedPlan} logo={logo} isGeneratingSummary={generatingSummaryForPlanId === selectedPlan.id} isTranslating={isTranslating} onRetrySummary={() => handleRetrySummary(selectedPlan.id)} onTranslateSummary={() => handleTranslateSummary(selectedPlan.id)} />
                                {selectedPlan?.aiSummaryChinese && !selectedPlan.aiSummaryChinese.startsWith('Translation failed') && (
                                    <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '1122px' }}>
                                        <BusinessPlan ref={businessPlanChineseRef} data={selectedPlan} logo={logo} isGeneratingSummary={false} isTranslating={false} onRetrySummary={() => {}} onTranslateSummary={() => {}} languageOverride="zh" />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                                    <div className="flex items-center space-x-2">
                                        <label htmlFor="containers" className="font-bold text-text-primary">Number of Containers:</label>
                                        <input id="containers" type="number" value={containerCount} onChange={e => setContainerCount(Math.max(1, parseInt(e.target.value, 10)))} min="1" className="p-2 border bg-surface border-gray-300 text-text-primary rounded-md w-24 text-center focus:ring-2 focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                        <PDFExportButton onClick={exportPurchaseOrder} isExporting={isExporting} librariesLoaded={pdfLibrariesLoaded} />
                                    </div>
                                </div>
                                <PurchaseOrder ref={purchaseOrderRef} data={selectedPlan} containerCount={containerCount} logo={logo} poNumber={currentPoNumber} />
                            </div>
                        )}
                    </div>
                );
            default:
                return <p>Loading...</p>;
        }
    };
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="bg-background min-h-screen flex flex-col items-center justify-center p-4">
                <div className="text-center bg-surface p-10 rounded-xl shadow-2xl border border-gray-200 max-w-md w-full animate-fade-in">
                    <Logo className="h-20 w-20 mx-auto mb-4 animate-float" />
                    <h1 className="text-3xl font-bold text-text-primary">Welcome to Nexstar Planner</h1>
                    <p className="text-text-secondary mt-2 mb-8">Please sign in with your Google account to continue.</p>
                    <button onClick={signInWithGoogle} className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-primary-hover transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-xl flex items-center justify-center text-lg">
                       <svg className="w-6 h-6 mr-3" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.622,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                        Sign in with Google
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-background min-h-screen font-sans text-text-primary">
            <header className="bg-surface/80 backdrop-blur-sm shadow-sm sticky top-0 z-10 border-b border-gray-200">
                <div className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-4">
                             <Logo className="h-10 w-10 animate-float" />
                             <label htmlFor="logo-upload" className="cursor-pointer text-text-secondary hover:text-primary transition-colors group relative" title="Upload Company Logo">
                                {logo ? <img src={logo} alt="Logo" className="h-10 w-10 bg-gray-100 p-1 rounded-md object-contain"/> : <div className="h-10 w-10 bg-secondary rounded-md flex items-center justify-center text-primary"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></div>}
                                <input id="logo-upload" type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                             </label>
                        </div>
                        <h1 className="text-xl font-semibold text-text-primary hidden sm:block">Nexstar Planner</h1>
                    </div>
                     <div className="flex items-center space-x-4">
                        {appView !== 'dashboard' && (
                            <button onClick={() => { setAppView('dashboard'); setFormInitialData(undefined); }} className="text-text-secondary hover:bg-secondary p-2 rounded-full text-sm font-medium transition-colors hover:text-primary" aria-label="Back to dashboard">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                            </button>
                        )}
                        {user && (
                            <div className="flex items-center space-x-3">
                                <img src={user.photoURL || undefined} alt={user.displayName || 'User'} className="h-8 w-8 rounded-full"/>
                                <button onClick={signOut} className="text-sm font-medium text-text-secondary hover:text-danger transition-colors">Sign Out</button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-8">
                {renderContent()}
            </main>

            {historyModalOpen && historyPdfUrl && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-5xl flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
                            <h3 className="text-lg font-bold text-text-primary">PDF Preview</h3>
                            <button onClick={closeHistoryModal} className="text-gray-400 hover:text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-full h-8 w-8 flex items-center justify-center transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-grow bg-gray-200">
                            <iframe src={historyPdfUrl} className="w-full h-full border-none" title="PDF Preview"></iframe>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;