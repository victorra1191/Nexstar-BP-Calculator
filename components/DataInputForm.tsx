import React, { useState, useEffect, useMemo } from 'react';
import type { BusinessPlanData } from '../types';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });


interface DataInputFormProps {
    onSave: (data: Omit<BusinessPlanData, 'id' | 'aiSummary'>) => void;
    onCancel: () => void;
    initialData?: Omit<BusinessPlanData, 'id' | 'aiSummary'>;
}

const getInitialFormState = (initialData?: Omit<BusinessPlanData, 'id' | 'aiSummary'>): Omit<BusinessPlanData, 'id' | 'aiSummary' | 'productImage'> & { productImage?: string } => {
    if (initialData) return initialData;

    return {
        nexstarModel: 'NX-RC18700',
        supplierReference: 'RC18',
        originalSupplier: 'GUANGDONG GAO BO ELECTRICAL APPLIANCE CO., LTD',
        destination: 'Mariel, CU',
        containerType: "40' HC",
        qtyFCL: 2880,
        fobCostUnit: 8.96,
        freightTotal: 5000.00,
        destinationCostsTotal: 400.00,
        estimatedSalesPrice: 14.00,
        totalUnitCost: 0, unitSalesMargin: 0, grossSalesMarginPercent: 0, grossMarkupPercent: 0,
        netMarkupPercent: 0, totalInvestment: 0, totalSales: 0, totalProfit: 0,
        interest15Percent: 0, netProfit: 0, netSalesMarginPercent: 0
    };
};

const InputField = ({ label, id, value, onChange, type = 'text', step, required = true }: { label: string; id: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; step?: string | number; required?: boolean; }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-text-secondary">{label}</label>
        <input
            type={type} id={id} name={id} value={value} onChange={onChange} step={step} required={required}
            className="mt-1 block w-full px-3 py-2 bg-surface border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-secondary focus:border-secondary sm:text-sm"
        />
    </div>
);

const CalculatedField = ({ label, value, isCurrency = false, isPercent = false }) => (
    <div className="flex justify-between items-center py-2.5 border-b">
        <span className="text-text-secondary text-sm">{label}</span>
        <span className="font-mono font-semibold text-primary">{`${isCurrency ? '$' : ''}${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${isPercent ? '%' : ''}`}</span>
    </div>
);

const DataInputForm: React.FC<DataInputFormProps> = ({ onSave, onCancel, initialData }) => {
    const [formData, setFormData] = useState(getInitialFormState(initialData));
    const [productImage, setProductImage] = useState(initialData?.productImage || '');
    
    useEffect(() => {
        setFormData(getInitialFormState(initialData));
        setProductImage(initialData?.productImage || '');
    }, [initialData]);

    const calculatedData = useMemo(() => {
        const { qtyFCL, fobCostUnit, freightTotal, destinationCostsTotal, estimatedSalesPrice } = formData;
        if (qtyFCL <= 0) return { ...formData };
        const freightPerUnit = freightTotal / qtyFCL;
        const destinationCostsPerUnit = destinationCostsTotal / qtyFCL;
        const totalUnitCost = fobCostUnit + freightPerUnit + destinationCostsPerUnit;
        const unitSalesMargin = estimatedSalesPrice - totalUnitCost;
        const totalInvestment = totalUnitCost * qtyFCL;
        const totalSales = estimatedSalesPrice * qtyFCL;
        const totalProfit = totalSales - totalInvestment;
        const grossSalesMarginPercent = totalSales > 0 ? (unitSalesMargin / estimatedSalesPrice) * 100 : 0;
        const grossMarkupPercent = totalUnitCost > 0 ? (unitSalesMargin / totalUnitCost) * 100 : 0;
        const interest15Percent = totalInvestment * 0.15;
        const netProfit = totalProfit - interest15Percent;
        const netSalesMarginPercent = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
        const netMarkupPercent = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;
        return { totalUnitCost, unitSalesMargin, totalInvestment, totalSales, totalProfit, grossSalesMarginPercent, grossMarkupPercent, interest15Percent, netProfit, netSalesMarginPercent, netMarkupPercent };
    }, [formData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };
    
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            setProductImage(base64);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...formData, ...calculatedData, productImage });
    };

    return (
        <form onSubmit={handleSubmit} className="bg-surface p-8 rounded-xl shadow-lg border animate-fade-in">
            <h2 className="text-3xl font-bold text-primary mb-6 border-b pb-4">{initialData ? 'Edit Business Plan' : 'Create New Business Plan'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-secondary">Input Data</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <InputField label="Nexstar Model" id="nexstarModel" value={formData.nexstarModel} onChange={handleChange} />
                         <InputField label="Supplier Reference" id="supplierReference" value={formData.supplierReference} onChange={handleChange} />
                    </div>
                     <InputField label="Original Supplier" id="originalSupplier" value={formData.originalSupplier} onChange={handleChange} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <InputField label="Destination" id="destination" value={formData.destination} onChange={handleChange} />
                         <InputField label="Container Type" id="containerType" value={formData.containerType} onChange={handleChange} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField label="Qty per FCL" id="qtyFCL" type="number" value={formData.qtyFCL} onChange={handleChange} />
                        <InputField label="FOB Cost (Unit)" id="fobCostUnit" type="number" step="0.01" value={formData.fobCostUnit} onChange={handleChange} />
                        <InputField label="Freight (Total)" id="freightTotal" type="number" step="0.01" value={formData.freightTotal} onChange={handleChange} />
                        <InputField label="Destination Costs" id="destinationCostsTotal" type="number" step="0.01" value={formData.destinationCostsTotal} onChange={handleChange} />
                    </div>
                     <InputField label="Sales Price (Unit)" id="estimatedSalesPrice" type="number" step="0.01" value={formData.estimatedSalesPrice} onChange={handleChange} />
                     <div>
                        <label className="block text-sm font-medium text-text-secondary">Product Image</label>
                        <div className="mt-1 flex items-center space-x-4">
                            <div className="w-24 h-24 rounded-md bg-gray-100 border flex items-center justify-center">
                                {productImage ? <img src={productImage} alt="Preview" className="w-full h-full object-cover rounded-md" /> : <span className="text-xs text-gray-500">Preview</span>}
                            </div>
                            <input type="file" id="productImage" name="productImage" onChange={handleImageUpload} accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-secondary mb-4">Calculated Results</h3>
                    <CalculatedField label="Total Unit Cost" value={calculatedData.totalUnitCost} isCurrency />
                    <CalculatedField label="Unit Sales Margin" value={calculatedData.unitSalesMargin} isCurrency />
                    <CalculatedField label="Gross Sales Margin" value={calculatedData.grossSalesMarginPercent} isPercent />
                    <CalculatedField label="Gross Markup" value={calculatedData.grossMarkupPercent} isPercent />
                    <hr className="my-4"/>
                    <CalculatedField label="Total Investment" value={calculatedData.totalInvestment} isCurrency />
                    <CalculatedField label="Total Sales" value={calculatedData.totalSales} isCurrency />
                    <CalculatedField label="Total Profit" value={calculatedData.totalProfit} isCurrency />
                     <hr className="my-4"/>
                    <CalculatedField label="Interest (15%)" value={calculatedData.interest15Percent} isCurrency />
                    <CalculatedField label="Net Profit" value={calculatedData.netProfit} isCurrency />
                    <CalculatedField label="Net Sales Margin" value={calculatedData.netSalesMarginPercent} isPercent />
                    <CalculatedField label="Net Markup" value={calculatedData.netMarkupPercent} isPercent />
                </div>
            </div>
            
            <div className="mt-8 pt-6 border-t flex justify-end space-x-4">
                <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-6 rounded-lg hover:bg-gray-300 transition-colors">Cancel</button>
                <button type="submit" className="bg-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-secondary transition-colors">Save Plan</button>
            </div>
        </form>
    );
};

export default DataInputForm;