import React from 'react';
import type { BusinessPlanData } from '../types';

interface SavedPlansProps {
    plans: BusinessPlanData[];
    onSelectPlan: (id: string) => void;
    onDeletePlan: (id: string) => void;
    onDuplicatePlan: (id: string) => void;
    onNewPlan: () => void;
}

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>;
const EmptyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const DuplicateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;


const SavedPlans: React.FC<SavedPlansProps> = ({ plans, onSelectPlan, onDeletePlan, onDuplicatePlan, onNewPlan }) => {
    return (
        <div className="bg-surface p-6 sm:p-8 rounded-xl shadow-lg border animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-4">
                <h2 className="text-3xl font-bold text-primary mb-2 sm:mb-0">Business Plan Dashboard</h2>
                <button onClick={onNewPlan} className="bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-secondary transition-colors flex items-center w-full sm:w-auto justify-center">
                    <PlusIcon /> New Plan
                </button>
            </div>

            {plans.length === 0 ? (
                <div className="text-center py-16">
                    <EmptyIcon />
                    <h3 className="text-xl font-semibold text-gray-700 mt-4">No plans saved yet.</h3>
                    <p className="text-gray-500 mt-2">Click "New Plan" to get started and create your first business plan.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plans.map(plan => (
                        <div key={plan.id} className="border rounded-lg shadow-sm flex flex-col justify-between hover:shadow-xl transition-shadow bg-background/50">
                            <div className="p-4">
                                {plan.productImage ? 
                                    <img src={plan.productImage} alt={plan.nexstarModel} className="w-full h-32 object-cover rounded-md mb-4"/> : 
                                    <div className="w-full h-32 bg-gray-200 rounded-md mb-4 flex items-center justify-center text-sm text-gray-400">No Image</div>
                                }
                                <h3 className="font-bold text-primary text-lg truncate">{plan.nexstarModel}</h3>
                                <p className="text-sm text-neutral mb-4">{plan.destination}</p>
                                <div className="text-sm space-y-2 font-mono">
                                    <p className="flex justify-between"><span>Investment:</span> <span className="font-semibold">${plan.totalInvestment.toLocaleString('en-US', {minimumFractionDigits: 2})}</span></p>
                                    <p className="flex justify-between"><span>Total Sales:</span> <span className="font-semibold">${plan.totalSales.toLocaleString('en-US', {minimumFractionDigits: 2})}</span></p>
                                    <p className="flex justify-between text-green-700"><span>Net Profit:</span> <span className="font-bold">${plan.netProfit.toLocaleString('en-US', {minimumFractionDigits: 2})}</span></p>
                                </div>
                            </div>
                            <div className="flex justify-end space-x-2 p-3 bg-gray-50 border-t rounded-b-lg">
                                <button onClick={() => onDeletePlan(plan.id)} className="text-sm text-red-600 hover:text-red-800 p-2 rounded-md hover:bg-red-100" aria-label={`Delete plan ${plan.nexstarModel}`} title="Delete">
                                    <TrashIcon />
                                </button>
                                <button onClick={() => onDuplicatePlan(plan.id)} className="text-sm text-accent hover:text-primary p-2 rounded-md hover:bg-gray-200" aria-label={`Duplicate plan ${plan.nexstarModel}`} title="Duplicate">
                                    <DuplicateIcon />
                                </button>
                                <button onClick={() => onSelectPlan(plan.id)} className="text-sm bg-secondary text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary transition-colors">
                                    View Details
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SavedPlans;