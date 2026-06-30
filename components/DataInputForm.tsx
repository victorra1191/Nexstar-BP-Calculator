

import React, { useState, useEffect, useMemo } from 'react';
import type { BusinessPlanData, Product } from '../types';

// NOTE: This fileToBase64 is now primarily used for immediate PREVIEW purposes in the form
// The actual upload to Storage happens via onProductImageUpload prop
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
    productImage: '', // Will be a URL from Storage
    cbmPerUnit: 0,
});

const getInitialFormState = (initialData?: BusinessPlanData): Omit<BusinessPlanData, 'id' | 'aiSummary' | 'createdAt' | 'updatedAt' | 'totalUnitCost' | 'unitSalesMargin' | 'grossSalesMarginPercent' | 'grossMarkupPercent' | 'netMarkupPercent' | 'totalInvestment' | 'totalSales' | 'totalProfit' | 'interest15Percent' | 'netProfit' | 'netSalesMarginPercent'> => {
    if (initialData) {
        const { id, aiSummary, createdAt, updatedAt, ...rest } = initialData;
        const financialDataStripped = { planName: rest.planName, destination: rest.destination, containerType: rest.containerType, containerCount: rest.containerCount || 1, freightTotal: rest.freightTotal, destinationCostsTotal: rest.destinationCostsTotal, products: rest.products };
        return financialDataStripped;
    };

    return {
        planName: 'Consolidated Container Plan',
        destination: 'Mariel, CU',
        containerType: "40' HC",
        containerCount: 1,
        freightTotal: 5000.00,
        destinationCostsTotal: 400.00,
        products: [createNewProduct()],
    };
};

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
    onProductImageUpload: (productId: string, file: File) => Promise<string>; // New prop for image upload
}

const DataInputForm: React.FC<DataInputFormProps> = ({ onSave, onCancel, initialData, onProductImageUpload }) => {
    const [formData, setFormData] = useState(getInitialFormState(initialData));
    const [previewImageUrls, setPreviewImageUrls] = useState<{ [productId: string]: string }>({}); // For immediate client-side preview
    const [uploadingImageId, setUploadingImageId] = useState<string | null>(null); // Track image being uploaded
    const [uploadErrors, setUploadErrors] = useState<{ [productId: string]: string }>({}); // Store upload errors per product

    useEffect(() => {
        setFormData(getInitialFormState(initialData));
        // Reset previews or set from initialData
        const initialPreviews: { [productId: string]: string } = {};
        initialData?.products.forEach(p => {
            if (p.productImage) initialPreviews[p.id] = p.productImage;
        });
        setPreviewImageUrls(initialPreviews);
        setUploadErrors({}); // Clear errors on form reset/initial load
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
    
    const handleImageFileChange = async (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            
            setUploadingImageId(productId);
            setUploadErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[productId]; // Clear previous error for this product
                return newErrors;
            });

            // Show immediate preview
            const previewUrl = await fileToBase64(file);
            setPreviewImageUrls(prev => ({ ...prev, [productId]: previewUrl }));

            try {
                // Upload to Firebase Storage
                const imageUrl = await onProductImageUpload(productId, file);
                setFormData(prev => ({
                    ...prev,
                    products: prev.products.map(p => p.id === productId ? { ...p, productImage: imageUrl } : p)
                }));
            } catch (error: any) {
                console.error(`[Upload Error] Failed to upload image for product ${productId}:`, error);
                setUploadErrors(prev => ({ ...prev, [productId]: error.message || "Unknown upload error" }));
                setPreviewImageUrls(prev => ({ ...prev, [productId]: '' })); // Clear preview on error
            } finally {
                setUploadingImageId(null);
            }
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
        setPreviewImageUrls(prev => { // Also remove preview URL
            const newPreviews = { ...prev };
            delete newPreviews[productId];
            return newPreviews;
        });
        setUploadErrors(prev => { // Also remove any error
            const newErrors = { ...prev };
            delete newErrors[productId];
            return newErrors;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...formData, ...calculatedData });
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white/40 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border border-white/50 animate-slide-in-up">
            <h2 className="text-3xl font-bold text-text-primary mb-8 border-b border-white/30 pb-4">{initialData?.id ? 'Edit Business Plan' : 'Create New Business Plan'}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="space-y-8 lg:col-span-3">
                    <div className="p-6 border border-white/60 rounded-3xl bg-white/30 backdrop-blur-md shadow-sm">
                        <h3 className="text-2xl font-semibold text-primary mb-5">Container Details</h3>
                        <div className="space-y-5">
                            <InputField label="Plan Name / ID" id="planName" value={formData.planName} onChange={handleContainerChange} />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                <InputField label="Destination" id="destination" value={formData.destination} onChange={handleContainerChange} />
                                <InputField label="Container Type" id="containerType" value={formData.containerType} onChange={handleContainerChange} />
                                <InputField label="Qty of Containers" id="containerCount" type="number" step="1" value={formData.containerCount || 1} onChange={handleContainerChange} />
                            </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <InputField label="Freight (Total)" id="freightTotal" type="number" step="0.01" value={formData.freightTotal} onChange={handleContainerChange} />
                                <InputField label="Destination Costs (Total)" id="destinationCostsTotal" type="number" step="0.01" value={formData.destinationCostsTotal} onChange={handleContainerChange} />
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="text-2xl font-semibold text-primary mb-5 ml-2">Products</h3>
                        <div className="space-y-6">
                            {formData.products.map((product, index) => (
                                <div key={product.id} className="p-6 border border-white/60 rounded-3xl relative bg-white/40 backdrop-blur-md shadow-sm transition-all hover:shadow-md">
                                    <h4 className="font-bold text-text-primary text-lg mb-5 border-b border-white/40 pb-2">Product #{index + 1}</h4>
                                     <button type="button" onClick={() => removeProduct(product.id)} className="absolute top-6 right-6 text-danger/70 hover:text-danger hover:bg-white/60 p-2 rounded-full transition-colors" aria-label="Remove Product">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                    <div className="space-y-5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <InputField label="Nexstar Model" id={`nexstarModel_${product.id}`} name="nexstarModel" value={product.nexstarModel} onChange={(e) => handleProductChange(product.id, e)} />
                                            <InputField label="Supplier Reference" id={`supplierReference_${product.id}`} name="supplierReference" value={product.supplierReference} onChange={(e) => handleProductChange(product.id, e)} />
                                        </div>
                                        <InputField label="Original Supplier" id={`originalSupplier_${product.id}`} name="originalSupplier" value={product.originalSupplier} onChange={(e) => handleProductChange(product.id, e)} />
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                                            <InputField label="Qty" id={`qtyInContainer_${product.id}`} name="qtyInContainer" type="number" value={product.qtyInContainer} onChange={(e) => handleProductChange(product.id, e)} />
                                            <InputField label="CBM (m³)" id={`cbmPerUnit_${product.id}`} name="cbmPerUnit" type="number" step="0.001" value={product.cbmPerUnit} onChange={(e) => handleProductChange(product.id, e)} />
                                            <InputField label="FOB ($)" id={`fobCostUnit_${product.id}`} name="fobCostUnit" type="number" step="0.01" value={product.fobCostUnit} onChange={(e) => handleProductChange(product.id, e)} />
                                            <InputField label="Sales ($)" id={`estimatedSalesPrice_${product.id}`} name="estimatedSalesPrice" type="number" step="0.01" value={product.estimatedSalesPrice} onChange={(e) => handleProductChange(product.id, e)} />
                                        </div>
                                         <div>
                                            <label className="block text-sm font-medium text-text-secondary mb-2">Product Image</label>
                                            <div className="mt-1 flex items-center space-x-5">
                                                <div className="w-24 h-24 rounded-2xl bg-white/50 border border-white flex items-center justify-center overflow-hidden shadow-sm">
                                                    {(previewImageUrls[product.id] || product.productImage) ? <img src={previewImageUrls[product.id] || product.productImage} alt="Preview" className="w-full h-full object-cover" /> : <span className="text-xs text-text-secondary font-medium">Preview</span>}
                                                </div>
                                                <input 
                                                    type="file" 
                                                    onChange={(e) => handleImageFileChange(product.id, e)} 
                                                    accept="image/*" 
                                                    className="block w-full text-sm text-text-secondary file:mr-4 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white/60 file:text-primary hover:file:bg-white transition-colors file:shadow-sm"
                                                    disabled={uploadingImageId === product.id} // Disable input while uploading
                                                />
                                            </div>
                                            {uploadingImageId === product.id && (
                                                <p className="flex items-center text-sm text-primary mt-3 font-medium">
                                                    <svg className="animate-spin h-4 w-4 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Uploading...
                                                </p>
                                            )}
                                            {uploadErrors[product.id] && (
                                                <p className="text-sm text-danger mt-3 bg-danger/10 p-2 rounded-lg">
                                                    Error: {uploadErrors[product.id]}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                         <button type="button" onClick={addProduct} className="mt-6 w-full py-4 border-2 border-dashed border-white/60 rounded-3xl text-primary font-bold hover:bg-white/40 hover:border-white transition-all flex justify-center items-center backdrop-blur-sm shadow-sm hover:shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            Add Another Product
                        </button>
                    </div>
                </div>

                <div className="space-y-4 bg-white/40 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-white/50 shadow-xl lg:col-span-2 self-start sticky top-24">
                    <h3 className="text-2xl font-bold text-primary mb-6 border-b border-white/30 pb-3">Consolidated Results</h3>
                    <CalculatedField label="Avg. Unit Cost" value={calculatedData.totalUnitCost} isCurrency />
                    <CalculatedField label="Avg. Unit Sales Margin" value={calculatedData.unitSalesMargin} isCurrency valueClass="text-accent font-semibold" />
                    <CalculatedField label="Gross Sales Margin" value={calculatedData.grossSalesMarginPercent} isPercent valueClass="text-accent font-semibold" />
                    <CalculatedField label="Gross Markup" value={calculatedData.grossMarkupPercent} isPercent valueClass="text-accent font-semibold" />
                    <hr className="my-5 border-white/40"/>
                    <CalculatedField label="Total Investment" value={calculatedData.totalInvestment} isCurrency />
                    <CalculatedField label="Total Sales" value={calculatedData.totalSales} isCurrency />
                    <CalculatedField label="Total Profit" value={calculatedData.totalProfit} isCurrency valueClass="text-accent font-semibold" />
                     <hr className="my-5 border-white/40"/>
                    <CalculatedField label="Interest (15%)" value={calculatedData.interest15Percent} isCurrency valueClass="text-danger font-semibold" />
                    <CalculatedField label="Net Profit" value={calculatedData.netProfit} isCurrency valueClass="text-accent font-bold text-lg" />
                    <CalculatedField label="Net Sales Margin" value={calculatedData.netSalesMarginPercent} isPercent valueClass="text-accent font-bold" />
                    <CalculatedField label="Net Markup" value={calculatedData.netMarkupPercent} isPercent valueClass="text-accent font-bold" />
                    
                    {(formData.containerCount || 1) > 1 && (
                        <div className="mt-8 pt-6 border-t border-white/40">
                            <h3 className="text-xl font-bold text-primary mb-4">Total ({formData.containerCount} Containers)</h3>
                            <CalculatedField label="Total Investment" value={calculatedData.totalInvestment * (formData.containerCount || 1)} isCurrency />
                            <CalculatedField label="Total Sales" value={calculatedData.totalSales * (formData.containerCount || 1)} isCurrency />
                            <CalculatedField label="Total Profit" value={calculatedData.totalProfit * (formData.containerCount || 1)} isCurrency valueClass="text-accent font-semibold" />
                            <CalculatedField label="Interest (15%)" value={calculatedData.interest15Percent * (formData.containerCount || 1)} isCurrency valueClass="text-danger font-semibold" />
                            <CalculatedField label="Net Profit" value={calculatedData.netProfit * (formData.containerCount || 1)} isCurrency valueClass="text-accent font-bold text-lg" />
                        </div>
                    )}
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