import React, { useState, useEffect, useMemo } from 'react';
import type { BusinessPlanData, Product } from '../types';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

const createNewProduct = (): Product => ({
    id: `product_${new Date().getTime()}_${Math.random()}`,
    nexstarModel: 'NX-MODEL',
    supplierReference: 'REF',
    originalSupplier: 'GUANGDONG GAO BO ELECTRICAL APPLIANCE CO., LTD',
    qtyInContainer: 100,
    fobCostUnit: 10.00,
    estimatedSalesPrice: 20.00,
    productImage: '',
});

const getInitialFormState = (initialData?: BusinessPlanData): Omit<BusinessPlanData, 'id' | 'aiSummary' | 'createdAt' | 'updatedAt' | 'totalUnitCost' | 'unitSalesMargin' | 'grossSalesMarginPercent' | 'grossMarkupPercent' | 'netMarkupPercent' | 'totalInvestment' | 'totalSales' | 'totalProfit' | 'interest15Percent' | 'netProfit' | 'netSalesMarginPercent'> => {
    if (initialData) {
        const { id, aiSummary, createdAt, updatedAt, ...rest } = initialData;
        const financialDataStripped = { planName: rest.planName, destination: rest.destination, containerType: rest.containerType, freightTotal: rest.freightTotal, destinationCostsTotal: rest.destinationCostsTotal, products: rest.products };
        return financialDataStripped;
    };

    return {
        planName: 'Consolidated Container Plan',
        destination: 'Mariel, CU',
        containerType: "40' HC",
        freightTotal: 5000.00,
        destinationCostsTotal: 400.00,
        products: [createNewProduct()],
    };
};

// FIX: Added optional 'name' prop to InputField to pass to the input element.
// This allows the onChange handlers to correctly identify the field being updated.
const InputField = ({ label, id, value, onChange, type = 'text', step, required = true, name }: { label: string; id: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; step?: string | number; required?: boolean; name?: string; }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
        <input
            type={type} id={id} name={name || id} value={value} onChange={onChange} step={step} required={required}
            className="block w-full px-3 py-2 bg-surface border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm text-text-primary"
        />
    </div>
);

const CalculatedField = ({ label, value, isCurrency = false, isPercent = false, valueClass = 'text-text-primary font-semibold' }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-200">
        <span className="text-text-secondary text-sm">{label}</span>
        <span className={`font-mono ${valueClass}`}>{`${isCurrency ? '$' : ''}${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${isPercent ? '%' : ''}`}</span>
    </div>
);

interface DataInputFormProps {
    onSave: (data: Omit<BusinessPlanData, 'id' | 'aiSummary' | 'createdAt' | 'updatedAt'>) => void;
    onCancel: () => void;
    initialData?: BusinessPlanData;
}

const DataInputForm: React.FC<DataInputFormProps> = ({ onSave, onCancel, initialData }) => {
    const [formData, setFormData] = useState(getInitialFormState(initialData));
    
    useEffect(() => {
        setFormData(getInitialFormState(initialData));
    }, [initialData]);

    const calculatedData = useMemo(() => {
        const { products, freightTotal, destinationCostsTotal } = formData;
        if (!products || products.length === 0) return { totalUnitCost: 0, unitSalesMargin: 0, totalInvestment: 0, totalSales: 0, totalProfit: 0, grossSalesMarginPercent: 0, grossMarkupPercent: 0, interest15Percent: 0, netProfit: 0, netSalesMarginPercent: 0, netMarkupPercent: 0 };
        
        const totalQty = products.reduce((sum, p) => sum + p.qtyInContainer, 0);
        if (totalQty <= 0) return { totalUnitCost: 0, unitSalesMargin: 0, totalInvestment: 0, totalSales: 0, totalProfit: 0, grossSalesMarginPercent: 0, grossMarkupPercent: 0, interest15Percent: 0, netProfit: 0, netSalesMarginPercent: 0, netMarkupPercent: 0 };

        const totalFobCosts = products.reduce((sum, p) => sum + (p.fobCostUnit * p.qtyInContainer), 0);
        
        const totalInvestment = totalFobCosts + freightTotal + destinationCostsTotal;
        const totalSales = products.reduce((sum, p) => sum + (p.estimatedSalesPrice * p.qtyInContainer), 0);

        const totalUnitCost = totalInvestment / totalQty; // Average unit cost
        const avgSalesPrice = totalSales / totalQty;
        const unitSalesMargin = avgSalesPrice - totalUnitCost; // Average margin

        const totalProfit = totalSales - totalInvestment;
        const grossSalesMarginPercent = totalSales > 0 ? ((totalSales - totalInvestment) / totalSales) * 100 : 0;
        const grossMarkupPercent = totalInvestment > 0 ? ((totalSales - totalInvestment) / totalInvestment) * 100 : 0;
        
        const interest15Percent = totalInvestment * 0.15;
        const netProfit = totalProfit - interest15Percent;
        const netSalesMarginPercent = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
        const netMarkupPercent = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

        return { totalUnitCost, unitSalesMargin, totalInvestment, totalSales, totalProfit, grossSalesMarginPercent, grossMarkupPercent, interest15Percent, netProfit, netSalesMarginPercent, netMarkupPercent };
    }, [formData]);

    const handleContainerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };

    const handleProductChange = (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            products: prev.products.map(p => 
                p.id === productId ? { ...p, [name]: type === 'number' ? parseFloat(value) || 0 : value } : p
            )
        }));
    };
    
    const handleImageUpload = async (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            setFormData(prev => ({
                ...prev,
                products: prev.products.map(p => p.id === productId ? { ...p, productImage: base64 } : p)
            }));
        }
    };
    
    const addProduct = () => {
        setFormData(prev => ({ ...prev, products: [...prev.products, createNewProduct()] }));
    };

    const removeProduct = (productId: string) => {
        if (formData.products.length <= 1) {
            alert("You must have at least one product in the plan.");
            return;
        }
        setFormData(prev => ({ ...prev, products: prev.products.filter(p => p.id !== productId) }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...formData, ...calculatedData });
    };

    return (
        <form onSubmit={handleSubmit} className="bg-surface p-8 rounded-xl shadow-2xl border border-gray-200 animate-slide-in-up">
            <h2 className="text-3xl font-bold text-text-primary mb-6 border-b border-gray-200 pb-4">{initialData?.id ? 'Edit Business Plan' : 'Create New Business Plan'}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="space-y-6 lg:col-span-3">
                    <div className="p-4 border border-gray-200 rounded-lg">
                        <h3 className="text-xl font-semibold text-primary mb-3">Container Details</h3>
                        <div className="space-y-4">
                            <InputField label="Plan Name / ID" id="planName" value={formData.planName} onChange={handleContainerChange} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InputField label="Destination" id="destination" value={formData.destination} onChange={handleContainerChange} />
                                <InputField label="Container Type" id="containerType" value={formData.containerType} onChange={handleContainerChange} />
                            </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InputField label="Freight (Total)" id="freightTotal" type="number" step="0.01" value={formData.freightTotal} onChange={handleContainerChange} />
                                <InputField label="Destination Costs (Total)" id="destinationCostsTotal" type="number" step="0.01" value={formData.destinationCostsTotal} onChange={handleContainerChange} />
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="text-xl font-semibold text-primary mb-3">Products</h3>
                        <div className="space-y-4">
                            {formData.products.map((product, index) => (
                                <div key={product.id} className="p-4 border border-gray-200 rounded-lg relative bg-background/50">
                                    <h4 className="font-bold text-text-secondary mb-3">Product #{index + 1}</h4>
                                     <button type="button" onClick={() => removeProduct(product.id)} className="absolute top-2 right-2 text-danger/60 hover:text-danger hover:bg-danger/10 p-1 rounded-full text-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <InputField label="Nexstar Model" id={`nexstarModel_${product.id}`} name="nexstarModel" value={product.nexstarModel} onChange={(e) => handleProductChange(product.id, e)} />
                                            <InputField label="Supplier Reference" id={`supplierReference_${product.id}`} name="supplierReference" value={product.supplierReference} onChange={(e) => handleProductChange(product.id, e)} />
                                        </div>
                                        <InputField label="Original Supplier" id={`originalSupplier_${product.id}`} name="originalSupplier" value={product.originalSupplier} onChange={(e) => handleProductChange(product.id, e)} />
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <InputField label="Qty in Container" id={`qtyInContainer_${product.id}`} name="qtyInContainer" type="number" value={product.qtyInContainer} onChange={(e) => handleProductChange(product.id, e)} />
                                            <InputField label="FOB Cost (Unit)" id={`fobCostUnit_${product.id}`} name="fobCostUnit" type="number" step="0.01" value={product.fobCostUnit} onChange={(e) => handleProductChange(product.id, e)} />
                                            <InputField label="Sales Price (Unit)" id={`estimatedSalesPrice_${product.id}`} name="estimatedSalesPrice" type="number" step="0.01" value={product.estimatedSalesPrice} onChange={(e) => handleProductChange(product.id, e)} />
                                        </div>
                                         <div>
                                            <label className="block text-sm font-medium text-text-secondary">Product Image</label>
                                            <div className="mt-1 flex items-center space-x-4">
                                                <div className="w-24 h-24 rounded-md bg-secondary border border-gray-300 flex items-center justify-center">
                                                    {product.productImage ? <img src={product.productImage} alt="Preview" className="w-full h-full object-cover rounded-md" /> : <span className="text-xs text-text-secondary">Preview</span>}
                                                </div>
                                                <input type="file" onChange={(e) => handleImageUpload(product.id, e)} accept="image/*" className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                         <button type="button" onClick={addProduct} className="mt-4 w-full bg-secondary text-primary font-bold py-2 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            Add Another Product
                        </button>
                    </div>
                </div>

                <div className="space-y-2 bg-background p-6 rounded-lg border border-gray-200 shadow-sm lg:col-span-2">
                    <h3 className="text-xl font-semibold text-primary mb-4">Consolidated Results</h3>
                    <CalculatedField label="Avg. Unit Cost" value={calculatedData.totalUnitCost} isCurrency />
                    <CalculatedField label="Avg. Unit Sales Margin" value={calculatedData.unitSalesMargin} isCurrency valueClass="text-accent font-semibold" />
                    <CalculatedField label="Gross Sales Margin" value={calculatedData.grossSalesMarginPercent} isPercent valueClass="text-accent font-semibold" />
                    <CalculatedField label="Gross Markup" value={calculatedData.grossMarkupPercent} isPercent valueClass="text-accent font-semibold" />
                    <hr className="my-3 border-gray-200"/>
                    <CalculatedField label="Total Investment" value={calculatedData.totalInvestment} isCurrency />
                    <CalculatedField label="Total Sales" value={calculatedData.totalSales} isCurrency />
                    <CalculatedField label="Total Profit" value={calculatedData.totalProfit} isCurrency valueClass="text-accent font-semibold" />
                     <hr className="my-3 border-gray-200"/>
                    <CalculatedField label="Interest (15%)" value={calculatedData.interest15Percent} isCurrency valueClass="text-danger font-semibold" />
                    <CalculatedField label="Net Profit" value={calculatedData.netProfit} isCurrency valueClass="text-accent font-bold text-lg" />
                    <CalculatedField label="Net Sales Margin" value={calculatedData.netSalesMarginPercent} isPercent valueClass="text-accent font-bold" />
                    <CalculatedField label="Net Markup" value={calculatedData.netMarkupPercent} isPercent valueClass="text-accent font-bold" />
                </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end space-x-4">
                <button type="button" onClick={onCancel} className="bg-secondary text-text-primary font-bold py-2 px-6 rounded-lg hover:bg-gray-300 transition-colors">Cancel</button>
                <button type="submit" className="bg-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-primary-hover transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transform hover:-translate-y-0.5">Save Plan</button>
            </div>
        </form>
    );
};

export default DataInputForm;