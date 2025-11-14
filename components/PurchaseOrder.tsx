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
        const totalQty = data.qtyFCL * containerCount;
        const totalFobCost = data.fobCostUnit * totalQty;
        const totalFreight = data.freightTotal * containerCount;
        const totalDestinationCost = data.destinationCostsTotal * containerCount;
        const grandTotal = totalFobCost + totalFreight + totalDestinationCost;
        return { totalQty, totalFobCost, totalFreight, totalDestinationCost, grandTotal };
    }, [data, containerCount]);
    
    return (
        <div ref={ref} className="bg-surface p-8 sm:p-10 rounded-xl shadow-lg font-mono border animate-fade-in">
            <header className="flex justify-between items-start pb-4 mb-6 border-b-2 border-gray-200">
                <div className="flex items-center space-x-4">
                    {logo ? <img src={logo} alt="Company Logo" className="h-16 object-contain" /> : <div className="h-16 w-32 bg-gray-200 rounded"></div>}
                    <div>
                        <h1 className="text-3xl font-bold text-primary">PURCHASE ORDER</h1>
                        <p className="text-gray-500">{poNumber}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-bold text-sm text-text-secondary">Date:</p>
                    <p>{new Date().toLocaleDateString('en-US')}</p>
                </div>
            </header>

            <section className="grid grid-cols-2 gap-8 mb-8 text-sm">
                 <div>
                    <h2 className="font-bold border-b mb-2 pb-1 text-text-secondary">SHIPPING FROM</h2>
                    <p className="font-semibold text-secondary">{data.originalSupplier}</p>
                    <p>Eduardo García</p>
                    <p>e.garcia@thenexstar.com</p>
                </div>
                 <div className="text-right">
                    <h2 className="font-bold border-b mb-2 pb-1 text-text-secondary">RECEIVING AT</h2>
                    <p className="font-semibold text-secondary">{data.destination}</p>
                    <p>Wang Jincheng</p>
                    <p>Wangjcheng@gmail.com</p>
                </div>
            </section>
            
            <section>
                <div className="overflow-x-auto">
                    <table className="w-full text-left table-auto text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3 font-semibold">MODEL</th>
                                <th className="p-3 font-semibold">DESCRIPTION</th>
                                <th className="p-3 text-right font-semibold">QTY/CONT.</th>
                                <th className="p-3 text-right font-semibold">CONTAINERS</th>
                                <th className="p-3 text-right font-semibold">TOTAL QTY</th>
                                <th className="p-3 text-right font-semibold">UNIT PRICE</th>
                                <th className="p-3 text-right font-semibold">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b">
                                <td className="p-3 font-bold">{data.nexstarModel}</td>
                                <td className="p-3">{data.supplierReference}</td>
                                <td className="p-3 text-right">{data.qtyFCL.toLocaleString()}</td>
                                <td className="p-3 text-right">{containerCount}</td>
                                <td className="p-3 text-right">{totals.totalQty.toLocaleString()}</td>
                                <td className="p-3 text-right">${data.fobCostUnit.toFixed(2)}</td>
                                <td className="p-3 text-right font-semibold">${totals.totalFobCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="grid grid-cols-2 gap-8 mt-8">
                <div>
                     {data.productImage ? (
                        <img src={data.productImage} alt="Product" className="w-full h-auto rounded-lg object-cover shadow-md border" />
                    ) : (
                        <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                            <p className="text-gray-500">Product Image</p>
                        </div>
                    )}
                </div>
                <div className="flex flex-col justify-end text-sm">
                    <div className="space-y-2">
                        <div className="flex justify-between"><span>Subtotal (FOB)</span> <span>${totals.totalFobCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between"><span>Freight</span> <span>${totals.totalFreight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between"><span>Destination Costs</span> <span>${totals.totalDestinationCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between border-t-2 border-black mt-2 pt-2 font-bold text-lg">
                            <span>GRAND TOTAL</span>
                            <span>${totals.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="mt-16 grid grid-cols-2 gap-8">
                <div>
                    <h3 className="font-bold">Notes:</h3>
                    <p className="text-xs text-text-secondary">All prices are in USD. Payment terms: 30 days net.</p>
                </div>
                 <div className="text-center">
                    <div className="border-b-2 border-gray-400 w-3/4 mx-auto pb-8"></div>
                    <p className="mt-2 font-bold text-sm">Approved By: Wang J Cheng</p>
                </div>
            </footer>
        </div>
    );
});

export default PurchaseOrder;