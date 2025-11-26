import React, { forwardRef, useMemo } from 'react';
import type { BusinessPlanData } from '../types';

interface PurchaseOrderProps {
    data: BusinessPlanData;
    containerCount: number;
    logo: string;
    poNumber: string;
}

const PurchaseOrder = forwardRef<HTMLDivElement, PurchaseOrderProps>(({ data, containerCount, logo, poNumber }, ref) => {

    const totals = useMemo(() => {
        const totalQty = data.products.reduce((acc, p) => acc + (p.qtyInContainer || 0), 0) * containerCount;
        const totalFobCost = data.products.reduce((acc, p) => acc + ((p.fobCostUnit || 0) * (p.qtyInContainer || 0)), 0) * containerCount;
        const totalFreight = (data.freightTotal || 0) * containerCount;
        const totalDestinationCost = (data.destinationCostsTotal || 0) * containerCount;
        const grandTotal = totalFobCost + totalFreight + totalDestinationCost;
        return { totalQty, totalFobCost, totalFreight, totalDestinationCost, grandTotal };
    }, [data, containerCount]);
    
    return (
        <div ref={ref} className="bg-surface text-text-primary p-10 sm:p-12 rounded-lg shadow-2xl font-sans animate-slide-in-up" style={{ fontFamily: 'Arial, sans-serif' }}>
            <header className="flex justify-between items-start pb-6 mb-8 border-b-2 border-gray-200">
                <div className="flex items-center space-x-6">
                    {logo ? <img src={logo} alt="Company Logo" className="h-16 object-contain" /> : <div className="h-16 w-32 bg-gray-100 rounded"></div>}
                    <div>
                        <p className="text-base text-text-secondary">Official Document</p>
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="text-4xl font-bold text-primary">PURCHASE ORDER</h1>
                    <p className="text-text-secondary font-mono mt-1">{poNumber}</p>
                    <p className="text-text-secondary font-mono text-base">Date: {new Date().toLocaleDateString('en-US')}</p>
                </div>
            </header>

            <section className="grid grid-cols-2 gap-8 mb-10 text-base">
                 <div>
                    <h2 className="font-semibold text-text-secondary tracking-wider uppercase mb-2">SUPPLIER</h2>
                    <p className="font-bold text-text-primary">{data.products[0]?.originalSupplier || 'N/A'}</p>
                    <p>Wang Jincheng</p>
                    <p>Wangjcheng@gmail.com</p>
                </div>
                 <div className="text-right">
                    <h2 className="font-semibold text-text-secondary tracking-wider uppercase mb-2">SHIP TO</h2>
                    <p className="font-bold text-text-primary">{data.destination}</p>
                    <p>Eduardo García</p>
                    <p>e.garcia@thenexstar.com</p>
                </div>
            </section>
            
            <section>
                <div className="overflow-x-auto border rounded-md">
                    <table className="w-full text-left table-auto text-base">
                        <thead className="bg-background border-b border-gray-200">
                            <tr>
                                <th className="p-3 font-semibold text-text-secondary uppercase w-2/5">Product</th>
                                <th className="p-3 text-right font-semibold text-text-secondary uppercase">Qty/Cont.</th>
                                <th className="p-3 text-right font-semibold text-text-secondary uppercase">Containers</th>
                                <th className="p-3 text-right font-semibold text-text-secondary uppercase">Total Qty</th>
                                <th className="p-3 text-right font-semibold text-text-secondary uppercase">Unit Price</th>
                                <th className="p-3 text-right font-semibold text-text-secondary uppercase">Total</th>
                            </tr>
                        </thead>
                        <tbody className="font-mono">
                            {data.products.map(product => {
                                const qty = product.qtyInContainer || 0;
                                const cost = product.fobCostUnit || 0;
                                return (
                                <tr key={product.id} className="border-b border-gray-100">
                                    <td className="p-3">
                                        <div className="flex items-center space-x-4">
                                            {product.productImage ? (
                                                <img src={product.productImage} alt={product.nexstarModel} className="h-14 w-14 object-cover rounded-md border p-1" />
                                            ) : (
                                                <div className="h-14 w-14 bg-gray-100 rounded-md flex items-center justify-center text-xs text-gray-400">No Image</div>
                                            )}
                                            <div>
                                                <p className="font-bold text-primary font-sans">{product.nexstarModel}</p>
                                                <p className="text-text-secondary text-sm">{product.supplierReference}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3 text-right text-text-secondary">{qty.toLocaleString()}</td>
                                    <td className="p-3 text-right text-text-secondary">{containerCount}</td>
                                    <td className="p-3 text-right text-text-secondary">{(qty * containerCount).toLocaleString()}</td>
                                    <td className="p-3 text-right text-text-secondary">${cost.toFixed(2)}</td>
                                    <td className="p-3 text-right font-semibold text-text-primary">${(cost * qty * containerCount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="flex justify-end mt-8">
                <div className="w-full max-w-sm text-base space-y-3 font-mono">
                    <div className="flex justify-between text-text-secondary">
                        <span>Subtotal (FOB)</span> 
                        <span>${totals.totalFobCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                        <span>Freight</span>
                        <span>${totals.totalFreight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                        <span>Destination Costs</span>
                        <span>${totals.totalDestinationCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-t-2 border-primary mt-4 pt-3 font-bold text-xl text-primary">
                        <span>GRAND TOTAL (USD)</span>
                        <span>${totals.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </section>

            <section className="mt-20 grid grid-cols-2 gap-20 text-base">
                <div className="text-center">
                    <div className="border-t border-gray-400 pt-2">Authorized Signature</div>
                </div>
                <div className="text-center">
                     <div className="border-t border-gray-400 pt-2">Name / Title</div>
                </div>
            </section>

             <footer className="mt-16 text-sm text-text-secondary text-center border-t pt-4">
                <p><span className="font-semibold">Notes:</span> All prices are in USD. Terms: 30% downpayment and 70% against BL.</p>
                <p>If you have any questions about this purchase order, please contact Eduardo García at e.garcia@thenexstar.com</p>
            </footer>
        </div>
    );
});

export default PurchaseOrder;