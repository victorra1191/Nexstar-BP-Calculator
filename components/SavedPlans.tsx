import React, { useState } from 'react';
import type { BusinessPlanData, ExportHistoryItem } from '../types';

interface SavedPlansProps {
    plans: BusinessPlanData[];
    archivedPlans: BusinessPlanData[];
    history: ExportHistoryItem[];
    onSelectPlan: (id: string) => void;
    onArchivePlan: (id: string) => void;
    onRestorePlan: (id: string) => void;
    onDeletePermanently: (id: string) => void;
    onDuplicatePlan: (id:string) => void;
    onEditPlan: (id: string) => void;
    onNewPlan: () => void;
    onViewHistoryItem: (id: string) => void;
    onUpdateHistoryStatus: (id: string, status: 'approved' | 'disapproved') => void;
    onImportFromPdf: (event: React.ChangeEvent<HTMLInputElement>) => void;
    isImportingPdf: boolean;
    pdfLibrariesLoaded: boolean;
}

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>;
const EmptyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const ArchiveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 001.414 0l2.414-2.414a1 1 0 01.707-.293H17" /></svg>;
const RestoreIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M7 9l4-4 4 4M20 20v-5h-5M17 15l-4 4-4-4" /></svg>;
const DuplicateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const ApproveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
const DisapproveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
const ImportIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;


const SavedPlans: React.FC<SavedPlansProps> = ({ plans, archivedPlans, history, onSelectPlan, onArchivePlan, onRestorePlan, onDeletePermanently, onDuplicatePlan, onEditPlan, onNewPlan, onViewHistoryItem, onUpdateHistoryStatus, onImportFromPdf, isImportingPdf, pdfLibrariesLoaded }) => {
    const [archivingId, setArchivingId] = useState<string | null>(null);

    const handleArchiveClick = (e: React.MouseEvent, planId: string) => {
        e.stopPropagation();
        setArchivingId(planId);
        setTimeout(() => {
            onArchivePlan(planId);
            setArchivingId(null);
        }, 300); // Duration should match the animation
    };

    const lastUpdatedDate = plans.length > 0
        ? plans.reduce((latest, plan) => {
            const planDate = new Date(plan.updatedAt);
            return planDate > latest ? planDate : latest;
        }, new Date(0))
        : null;

    return (
        <div className="bg-surface p-6 sm:p-8 rounded-xl shadow-lg border border-gray-200 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-gray-200 pb-4">
                <div>
                    <h2 className="text-3xl font-bold text-text-primary mb-1">Business Plans</h2>
                    {lastUpdatedDate && (
                         <p className="text-xs text-text-secondary font-mono">Last Updated: {lastUpdatedDate.toLocaleString()}</p>
                    )}
                </div>
                <div className="flex items-center space-x-2 mt-4 sm:mt-0 w-full flex-wrap gap-2 sm:w-auto">
                     <label className={`bg-blue-100 text-blue-800 font-medium py-2 px-4 rounded-lg hover:bg-blue-200 transition-colors flex items-center justify-center cursor-pointer flex-1 sm:flex-initial ${isImportingPdf || !pdfLibrariesLoaded ? 'opacity-50 cursor-not-allowed' : ''}`} title="Import from PDF">
                        {isImportingPdf ? (
                            <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <ImportIcon />
                        )}
                        <span className="ml-2 hidden md:inline">{isImportingPdf ? 'Importing...' : 'Import PDF'}</span>
                        <input type="file" onChange={onImportFromPdf} className="hidden" accept=".pdf" disabled={isImportingPdf || !pdfLibrariesLoaded} />
                    </label>
                    <button onClick={onNewPlan} className="bg-accent text-white font-bold py-2 px-5 rounded-lg hover:bg-accent-hover transition-all duration-300 flex items-center justify-center shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transform hover:-translate-y-0.5 flex-1 sm:flex-initial">
                        <PlusIcon /> New Plan
                    </button>
                </div>
            </div>

            {plans.length === 0 ? (
                <div className="text-center py-20 px-6 bg-background rounded-lg border border-gray-200">
                    <EmptyIcon />
                    <h3 className="text-2xl font-bold text-text-primary mt-6">No Saved Plans Yet</h3>
                    <p className="text-text-secondary mt-2 max-w-md mx-auto">It looks like you haven't created any business plans yet. Let's change that!</p>
                    <button onClick={onNewPlan} className="mt-8 bg-accent text-white font-bold py-3 px-6 rounded-lg hover:bg-accent-hover transition-all duration-300 flex items-center mx-auto shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transform hover:-translate-y-0.5">
                        <PlusIcon /> Create Your First Plan
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plans.map((plan, index) => (
                        <div key={plan.id} 
                             className={`border border-gray-200 rounded-lg shadow-md flex flex-col justify-between bg-surface hover:-translate-y-1 hover:shadow-xl hover:border-primary/50 transition-all duration-300 group ${archivingId === plan.id ? 'opacity-0 scale-95' : ''}`}
                             style={{ animation: `slideInUp 0.5s ${index * 0.1}s ease-out forwards`, opacity: 0 }}>
                            <div className="p-4 cursor-pointer" onClick={() => onSelectPlan(plan.id)}>
                                {plan.products[0]?.productImage ? 
                                    <img src={plan.products[0].productImage} alt={plan.planName} className="w-full h-32 object-cover rounded-md mb-4"/> : 
                                    <div className="w-full h-32 bg-secondary rounded-md mb-4 flex items-center justify-center text-sm text-text-secondary">No Image</div>
                                }
                                <h3 className="font-bold text-text-primary text-lg truncate group-hover:text-primary transition-colors">{plan.planName}</h3>
                                <p className="text-sm text-text-secondary">{plan.products.length} {plan.products.length > 1 ? 'Products' : 'Product'}</p>
                                <p className="text-xs text-text-secondary/80 mt-1 mb-3">Created: {new Date(plan.createdAt).toLocaleDateString()}</p>
                                <div className="text-sm space-y-2 font-mono text-text-secondary">
                                    <p className="flex justify-between"><span>Investment:</span> <span className="font-semibold text-text-primary">${(plan.totalInvestment || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</span></p>
                                    <p className="flex justify-between"><span>Total Sales:</span> <span className="font-semibold text-text-primary">${(plan.totalSales || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</span></p>
                                    <p className="flex justify-between"><span>Net Profit:</span> <span className="font-bold text-accent">${(plan.netProfit || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</span></p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-background border-t border-gray-200 rounded-b-lg">
                                <div className="flex space-x-1">
                                    <button onClick={(e) => handleArchiveClick(e, plan.id)} className="text-sm text-text-secondary hover:text-orange-600 p-2 rounded-md hover:bg-orange-100" aria-label={`Archive plan ${plan.planName}`} title="Archive">
                                        <ArchiveIcon />
                                    </button>
                                     <button onClick={(e) => { e.stopPropagation(); onEditPlan(plan.id); }} className="text-sm text-text-secondary hover:text-text-primary p-2 rounded-md hover:bg-black/5" aria-label={`Edit plan ${plan.planName}`} title="Edit">
                                        <EditIcon />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); onDuplicatePlan(plan.id); }} className="text-sm text-text-secondary hover:text-text-primary p-2 rounded-md hover:bg-black/5" aria-label={`Duplicate plan ${plan.planName}`} title="Duplicate">
                                        <DuplicateIcon />
                                    </button>
                                </div>
                                <button onClick={() => onSelectPlan(plan.id)} className="text-sm bg-primary text-white font-semibold py-1.5 px-4 rounded-lg hover:bg-primary-hover transition-colors">
                                    View
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {archivedPlans.length > 0 && (
                <div className="mt-12 animate-fade-in" style={{animationDelay: '0.3s', opacity: 0}}>
                    <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
                        <h2 className="text-3xl font-bold text-text-primary">Archived Plans</h2>
                    </div>
                     <div className="space-y-3">
                        {archivedPlans.map(plan => (
                            <div key={plan.id} className="bg-background/70 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center border border-gray-200/80 hover:bg-background transition-colors opacity-80 hover:opacity-100">
                                <div className="mb-2 sm:mb-0 flex-grow">
                                    <p className="font-semibold text-text-primary">{plan.planName}</p>
                                    <p className="text-sm text-text-secondary">{plan.products.length} {plan.products.length > 1 ? 'Products' : 'Product'}</p>
                                    <p className="text-xs text-text-secondary/80 font-mono mt-1">Archived on: {new Date(plan.updatedAt).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center space-x-2 self-start sm:self-center">
                                    <button onClick={() => onRestorePlan(plan.id)} title="Restore" className="p-2 rounded-md text-accent hover:bg-accent/10 flex items-center text-sm font-semibold">
                                        <RestoreIcon /> <span className="ml-1 hidden sm:inline">Restore</span>
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); onDeletePermanently(plan.id); }} title="Delete Permanently" className="p-2 rounded-md text-danger hover:bg-danger/10 flex items-center text-sm font-semibold">
                                        <TrashIcon /> <span className="ml-1 hidden sm:inline">Delete Forever</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-12 animate-fade-in" style={{animationDelay: '0.5s', opacity: 0}}>
                <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
                    <h2 className="text-3xl font-bold text-text-primary">Export History</h2>
                </div>
                {history.length === 0 ? (
                     <div className="text-center py-10 px-6 bg-background rounded-lg border border-gray-200">
                        <p className="text-text-secondary">Your exported documents will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {history.map(item => (
                            <div key={item.id} className="bg-background/70 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center border border-gray-200/80 hover:bg-background transition-colors">
                                <div className="mb-2 sm:mb-0 flex-grow">
                                    <span className={`text-xs font-bold uppercase py-1 px-2 rounded-full ${item.type === 'plan' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                        {item.type === 'plan' ? 'Business Plan' : 'Purchase Order'}
                                    </span>
                                    <p className="font-semibold text-text-primary mt-2">{item.planModel}</p>
                                    {item.type === 'po' && <p className="text-sm text-text-secondary">{item.poNumber} ({item.containerCount} containers)</p>}
                                     <p className="text-xs text-text-secondary/80 font-mono mt-1">{new Date(item.exportedAt).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center space-x-2 self-start sm:self-center">
                                    <span className={`text-xs font-bold py-1 px-2.5 rounded-full capitalize ${
                                        item.status === 'approved' ? 'bg-green-200 text-green-800' :
                                        item.status === 'disapproved' ? 'bg-red-200 text-red-800' :
                                        'bg-yellow-200 text-yellow-800'
                                    }`}>
                                        {item.status}
                                    </span>
                                    <button onClick={() => onUpdateHistoryStatus(item.id, 'approved')} title="Approve" className="p-2 rounded-md text-green-600 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed" disabled={item.status === 'approved'}>
                                        <ApproveIcon />
                                    </button>
                                    <button onClick={() => onUpdateHistoryStatus(item.id, 'disapproved')} title="Disapprove" className="p-2 rounded-md text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed" disabled={item.status === 'disapproved'}>
                                        <DisapproveIcon />
                                    </button>
                                     <button 
                                        onClick={() => onViewHistoryItem(item.id)} 
                                        className="text-sm bg-secondary text-text-primary font-semibold py-1.5 px-4 rounded-lg hover:bg-gray-300 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                        disabled={!item.pdfDataUrl}
                                        title={!item.pdfDataUrl ? "PDF preview is only available for the current session" : "View PDF"}
                                     >
                                        View PDF
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
};

export default SavedPlans;