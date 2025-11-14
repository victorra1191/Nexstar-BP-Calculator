import React, { useState, useRef, useCallback, useEffect } from 'react';
import BusinessPlan from './components/BusinessPlan';
import PurchaseOrder from './components/PurchaseOrder';
import DataInputForm from './components/DataInputForm';
import SavedPlans from './components/SavedPlans';
import { generateBusinessPlanSummary } from './services/geminiService';
import type { BusinessPlanData, ViewType, AppView } from './types';

// @ts-ignore
const { jsPDF } = window.jspdf;
// @ts-ignore
const html2canvas = window.html2canvas;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

interface PDFExportButtonProps {
    targetRef: React.RefObject<HTMLDivElement>;
    fileName: string;
}

const PDFExportButton: React.FC<PDFExportButtonProps> = ({ targetRef, fileName }) => {
    const [isExporting, setIsExporting] = useState(false);

    const exportToPdf = async () => {
        if (!targetRef.current) return;
        setIsExporting(true);
        try {
            const canvas = await html2canvas(targetRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps = pdf.getImageProperties(imgData);
            const ratio = imgProps.height / imgProps.width;
            const width = pdfWidth - 20;
            const height = width * ratio;
            pdf.addImage(imgData, 'PNG', 10, 10, width, height > pdfHeight - 20 ? pdfHeight - 20 : height);
            pdf.save(`${fileName}.pdf`);
        } catch (error) {
            console.error("Error exporting to PDF:", error);
        } finally {
            setIsExporting(false);
        }
    };
    return (
        <button
            onClick={exportToPdf} disabled={isExporting}
            className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 flex items-center"
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
    // FIX: Change formInitialData state to hold the full BusinessPlanData object to retain the 'id' for editing.
    const [formInitialData, setFormInitialData] = useState<BusinessPlanData | undefined>(undefined);
    const [currentPoNumber, setCurrentPoNumber] = useState('');
    
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

    const handleSavePlan = async (planData: Omit<BusinessPlanData, 'id' | 'aiSummary'>) => {
        const summary = await generateBusinessPlanSummary(planData as BusinessPlanData); // Cast because summary generation doesn't need all calculated fields yet
        
        const existingIndex = plans.findIndex(p => p.id === formInitialData?.id);
        if (existingIndex !== -1) {
             const updatedPlan = { ...planData, id: formInitialData!.id, aiSummary: summary };
             setPlans(prev => {
                const newPlans = [...prev];
                newPlans[existingIndex] = updatedPlan;
                return newPlans;
            });
        } else {
             const newPlan = { ...planData, id: new Date().toISOString(), aiSummary: summary };
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

    const handleDuplicatePlan = (planId: string) => {
        const planToDuplicate = plans.find(p => p.id === planId);
        if (planToDuplicate) {
            // Create a new object to avoid issues with references
            const duplicatedData = { ...planToDuplicate };
            // Modify name to indicate it's a copy
            duplicatedData.nexstarModel = `${duplicatedData.nexstarModel} (Copy)`;
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

    const renderContent = () => {
        switch(appView) {
            case 'dashboard':
                return <SavedPlans plans={plans} onSelectPlan={handleSelectPlan} onDeletePlan={handleDeletePlan} onDuplicatePlan={handleDuplicatePlan} onNewPlan={handleNewPlan} />;
            case 'new_plan':
                // FIX: Strip 'id' and 'aiSummary' before passing to the form to match prop types.
                const initialDataForForm = formInitialData ? (({ id, aiSummary, ...rest }) => rest)(formInitialData) : undefined;
                return <DataInputForm onSave={handleSavePlan} onCancel={() => setAppView('dashboard')} initialData={initialDataForForm} />;
            case 'view_plan':
                if (!selectedPlan) return <p>No plan selected.</p>;
                return (
                    <div className="animate-fade-in">
                        <div className="bg-surface p-4 rounded-lg shadow-md mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-primary">Viewing: {selectedPlan.nexstarModel}</h2>
                                <p className="text-neutral">Select a report view below.</p>
                            </div>
                             <div className="bg-secondary p-1 rounded-lg flex space-x-1 self-stretch sm:self-center">
                                {(['plan', 'po'] as ViewType[]).map(view => (
                                     <button key={view} onClick={() => handleViewReport(view)}
                                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-full sm:w-auto ${activeReportView === view ? 'bg-surface text-primary shadow' : 'text-white hover:bg-accent'}`}
                                    >
                                        {view === 'plan' ? 'Business Plan' : 'Purchase Order'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {activeReportView === 'plan' ? (
                            <div>
                                <div className="flex justify-end mb-4">
                                <PDFExportButton targetRef={businessPlanRef} fileName={`Business_Plan_${selectedPlan.nexstarModel}`} />
                                </div>
                                <BusinessPlan ref={businessPlanRef} data={selectedPlan} logo={logo} />
                            </div>
                        ) : (
                            <div>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                                    <div className="flex items-center space-x-2">
                                        <label htmlFor="containers" className="font-bold text-primary">Number of Containers:</label>
                                        <input id="containers" type="number" value={containerCount} onChange={e => setContainerCount(Math.max(1, parseInt(e.target.value, 10)))} min="1"
                                            className="p-2 border border-neutral rounded-md w-24 text-center focus:ring-2 focus:ring-accent focus:border-accent"
                                        />
                                    </div>
                                    <PDFExportButton targetRef={purchaseOrderRef} fileName={`PO_${selectedPlan.nexstarModel}_${containerCount}c`} />
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
            <header className="bg-primary shadow-lg sticky top-0 z-10">
                <div className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            {logo ? <img src={logo} alt="Logo" className="h-10 bg-white p-1 rounded-md object-contain"/> : <div className="h-10 w-10 bg-gray-300 rounded-md"></div>}
                             <label htmlFor="logo-upload" className="cursor-pointer text-white hover:text-neutral transition-colors" title="Upload Logo">
                                <input id="logo-upload" type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                             </label>
                        </div>
                        <h1 className="text-xl font-semibold text-white hidden sm:block">Business Planner</h1>
                    </div>
                     <button
                        onClick={() => setAppView('dashboard')}
                        className="text-white hover:bg-secondary p-2 rounded-full text-sm font-medium transition-colors"
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
        </div>
    );
};

export default App;
