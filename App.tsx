import React, { useState, useRef, useCallback, useEffect } from 'react';
import BusinessPlan from './components/BusinessPlan';
import PurchaseOrder from './components/PurchaseOrder';
import DataInputForm from './components/DataInputForm';
import SavedPlans from './components/SavedPlans';
import Logo from './components/Logo';
import { generateBusinessPlanSummary } from './services/geminiService';
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
}

const PDFExportButton: React.FC<PDFExportButtonProps> = ({ onClick, isExporting }) => {
    return (
        <button
            onClick={onClick} disabled={isExporting}
            className="bg-primary text-white font-bold py-2 px-5 rounded-lg hover:bg-primary-hover transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transform hover:-translate-y-0.5"
        >
             {isExporting ? 'Exporting...' : (
                <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export PDF
                </>
             )}
        </button>
    );
};


const App: React.FC = () => {
    const [plans, setPlans] = useState<BusinessPlanData[]>([]);
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
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyPdfUrl, setHistoryPdfUrl] = useState<string | null>(null);
    
    const businessPlanRef = useRef<HTMLDivElement>(null);
    const purchaseOrderRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        try {
            const savedPlans = localStorage.getItem('businessPlans');
            if (savedPlans) setPlans(JSON.parse(savedPlans));

            const savedLogo = localStorage.getItem('companyLogo');
            if(savedLogo) setLogo(savedLogo);

            const savedPoCounter = localStorage.getItem('poCounter');
            if (savedPoCounter) setPoCounter(parseInt(savedPoCounter, 10));

            const savedHistory = localStorage.getItem('exportHistory');
            if (savedHistory) setExportHistory(JSON.parse(savedHistory));

        } catch (error) { console.error("Failed to load from localStorage:", error); }
    }, []);

    useEffect(() => {
        try { localStorage.setItem('businessPlans', JSON.stringify(plans)); } 
        catch (error) { console.error("Failed to save plans to localStorage:", error); }
    }, [plans]);

    useEffect(() => {
        try { localStorage.setItem('companyLogo', logo); } 
        catch (error) { console.error("Failed to save logo to localStorage:", error); }
    }, [logo]);
    
    useEffect(() => {
        try { localStorage.setItem('poCounter', poCounter.toString()); }
        catch (error) { console.error("Failed to save PO counter to localStorage:", error); }
    }, [poCounter]);

    useEffect(() => {
        try { 
            // Create a version of the history without the large PDF data to avoid storage quota errors.
            const historyToSave = exportHistory.map(item => {
                const { pdfDataUrl, ...rest } = item;
                return rest;
            });
            localStorage.setItem('exportHistory', JSON.stringify(historyToSave)); 
        }
        catch (error) { console.error("Failed to save history to localStorage:", error); }
    }, [exportHistory]);


    const handleSavePlan = async (planData: Omit<BusinessPlanData, 'id' | 'aiSummary' | 'createdAt' | 'updatedAt'>) => {
        const summary = await generateBusinessPlanSummary(planData as BusinessPlanData);
        
        const existingPlan = plans.find(p => p.id === formInitialData?.id);
        
        if (existingPlan) {
             const updatedPlan = { 
                 ...existingPlan,
                 ...planData, 
                 aiSummary: summary,
                 updatedAt: new Date().toISOString()
             };
             setPlans(prev => prev.map(p => p.id === existingPlan.id ? updatedPlan : p));
        } else {
             const newPlan = { 
                 ...planData, 
                 id: new Date().toISOString(), 
                 aiSummary: summary,
                 createdAt: new Date().toISOString(),
                 updatedAt: new Date().toISOString()
             };
             setPlans(prev => [...prev, newPlan]);
        }

        setAppView('dashboard');
        setFormInitialData(undefined);
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
    
    const handleDeletePlan = (planId: string) => {
        if (window.confirm("Are you sure you want to delete this plan?")) {
            setPlans(prev => prev.filter(p => p.id !== planId));
        }
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
            const duplicatedData = { 
                ...planToDuplicate,
                id: '', // Remove id to make it a new plan
                planName: `${planToDuplicate.planName} (Copy)`
             };
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
        }
    };

    const handleViewReport = (view: ViewType) => {
        if (view === 'po' && activeReportView !== 'po') {
            const number = `PO-${new Date().getFullYear()}-${String(poCounter).padStart(4, '0')}`;
            setCurrentPoNumber(number);
            setPoCounter(prev => prev + 1);
        }
        setActiveReportView(view);
    };

    const handleAddToHistory = (type: ViewType, pdfDataUrl: string) => {
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

        setExportHistory(prev => [newItem, ...prev]);
    };

    const handleViewHistoryItem = (itemId: string) => {
        const item = exportHistory.find(h => h.id === itemId);
        // Only open the modal if the PDF data is available (for current session items)
        if (item && item.pdfDataUrl) {
            setHistoryPdfUrl(item.pdfDataUrl);
            setHistoryModalOpen(true);
        }
    };

    const handleUpdateHistoryStatus = (itemId: string, status: 'approved' | 'disapproved') => {
        setExportHistory(prev => 
            prev.map(item => 
                item.id === itemId ? { ...item, status } : item
            )
        );
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

        if (!html2canvas || !jsPDF) {
            alert("PDF export library failed to load. Please check your connection and try again.");
            setIsExporting(false);
            return;
        }

        const reportContainer = businessPlanRef.current;
        if (!reportContainer) return;
        
        setIsExporting(true);
        const originalClassName = reportContainer.className;
        reportContainer.className = originalClassName.replace(/animate-[a-z-]+/g, ' ');

        const page1 = reportContainer.querySelector<HTMLElement>('#bp-page-1');
        const page2 = reportContainer.querySelector<HTMLElement>('#bp-page-2');

        if (!page1 || !page2) {
            alert('Could not find page elements for PDF export.');
            setIsExporting(false);
            return;
        }

        try {
            const MARGIN = 40; // Add a 40pt margin
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const contentWidth = pdfWidth - MARGIN * 2;

            const canvasOptions = { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff' };
            
            // --- Process Page 1 ---
            const canvas1 = await html2canvas(page1, canvasOptions);
            const imgData1 = canvas1.toDataURL('image/png', 1.0);
            const imgHeight1 = (canvas1.height * contentWidth) / canvas1.width;
            pdf.addImage(imgData1, 'PNG', MARGIN, MARGIN, contentWidth, imgHeight1);

            // --- Process Page 2 ---
            pdf.addPage();
            const canvas2 = await html2canvas(page2, canvasOptions);
            const imgData2 = canvas2.toDataURL('image/png', 1.0);
            const imgHeight2 = (canvas2.height * contentWidth) / canvas2.width;
            pdf.addImage(imgData2, 'PNG', MARGIN, MARGIN, contentWidth, imgHeight2);
            
            const pdfDataUrl = pdf.output('datauristring');
            pdf.save(`Business_Plan_${selectedPlan?.planName}.pdf`);
            handleAddToHistory('plan', pdfDataUrl);

        } catch (error) {
            console.error("Error exporting Business Plan:", error);
            alert("An error occurred while exporting the Business Plan.");
        } finally {
            setIsExporting(false);
            if (reportContainer) reportContainer.className = originalClassName;
        }
    };
    
    const exportPurchaseOrder = async () => {
        // @ts-ignore
        const html2canvas = window.html2canvas;
        // @ts-ignore
        const { jsPDF } = window.jspdf;
        
        if (!html2canvas || !jsPDF) {
            alert("PDF export library failed to load. Please check your connection and try again.");
            setIsExporting(false);
            return;
        }

        const input = purchaseOrderRef.current;
        if (!input) return;

        setIsExporting(true);
        const originalClassName = input.className;
        input.className = originalClassName.replace(/animate-[a-z-]+/g, ' ');

        try {
            const MARGIN = 40; // Add a 40pt margin
            const canvas = await html2canvas(input, { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png', 1.0);
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const contentWidth = pdfWidth - MARGIN * 2;
            const imgHeight = (canvas.height * contentWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', MARGIN, MARGIN, contentWidth, imgHeight);

            const pdfDataUrl = pdf.output('datauristring');
            pdf.save(`PO_${selectedPlan?.planName}_${containerCount}c.pdf`);
            handleAddToHistory('po', pdfDataUrl);
        } catch (error)
 {
            console.error("Error exporting Purchase Order:", error);
            alert("An error occurred while exporting the Purchase Order.");
        } finally {
            setIsExporting(false);
            if (input) input.className = originalClassName;
        }
    };


    const renderContent = () => {
        switch(appView) {
            case 'dashboard':
                return <SavedPlans 
                            plans={plans} 
                            history={exportHistory} 
                            onSelectPlan={handleSelectPlan} 
                            onDeletePlan={handleDeletePlan} 
                            onDuplicatePlan={handleDuplicatePlan} 
                            onEditPlan={handleEditPlan} 
                            onNewPlan={handleNewPlan}
                            onViewHistoryItem={handleViewHistoryItem}
                            onUpdateHistoryStatus={handleUpdateHistoryStatus}
                        />;
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
                                     <button key={view} onClick={() => handleViewReport(view)}
                                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-300 w-full sm:w-auto ${activeReportView === view ? 'bg-primary text-white shadow' : 'text-text-primary hover:bg-white/60'}`}
                                    >
                                        {view === 'plan' ? 'Business Plan' : 'Purchase Order'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {activeReportView === 'plan' ? (
                            <div>
                                <div className="flex justify-end mb-4">
                                    <PDFExportButton onClick={exportBusinessPlan} isExporting={isExporting} />
                                </div>
                                <BusinessPlan ref={businessPlanRef} data={selectedPlan} logo={logo} />
                            </div>
                        ) : (
                            <div>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                                    <div className="flex items-center space-x-2">
                                        <label htmlFor="containers" className="font-bold text-text-primary">Number of Containers:</label>
                                        <input id="containers" type="number" value={containerCount} onChange={e => setContainerCount(Math.max(1, parseInt(e.target.value, 10)))} min="1"
                                            className="p-2 border bg-surface border-gray-300 text-text-primary rounded-md w-24 text-center focus:ring-2 focus:ring-primary focus:border-primary"
                                        />
                                    </div>
                                    <PDFExportButton onClick={exportPurchaseOrder} isExporting={isExporting} />
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
                     <button
                        onClick={() => { setAppView('dashboard'); setFormInitialData(undefined); }}
                        className="text-text-secondary hover:bg-secondary p-2 rounded-full text-sm font-medium transition-colors hover:text-primary"
                        aria-label="Back to dashboard"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                    </button>
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