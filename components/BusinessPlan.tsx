import React, { forwardRef } from 'react';
import type { BusinessPlanData, Product } from '../types';

const InfoItem: React.FC<{ label: string; value: string | number; isCurrency?: boolean; isPercent?: boolean; valueClass?: string; }> = ({ label, value, isCurrency = false, isPercent = false, valueClass = 'text-gray-800' }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-gray-200/80 text-base">
    <span className="text-gray-500">{label}</span>
    <span className={`font-medium ${valueClass}`}>
      {isCurrency && typeof value === 'number'
        ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : isPercent && typeof value === 'number'
        ? `${value.toFixed(2)}%`
        : value
      }
    </span>
  </div>
);

const OverviewMetricCard: React.FC<{ title: string; value: string; colorClass: string; }> = ({ title, value, colorClass }) => (
    <div className={`rounded-lg p-4 ${colorClass}`}>
        <p className="text-base text-gray-600 font-medium">{title}</p>
        <p className="text-3xl font-bold text-gray-800 mt-1 font-sans">{value}</p>
    </div>
);

const FinancialTable: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
    <div className="mb-6">
        <h4 className="text-base font-semibold text-gray-500 bg-gray-100/80 px-3 py-2 rounded-t-md border-b-2 border-gray-200">{title}</h4>
        <div className="px-3">
          {children}
        </div>
    </div>
);

interface BusinessPlanProps {
    data: BusinessPlanData;
    logo: string;
}

const BusinessPlan = forwardRef<HTMLDivElement, BusinessPlanProps>(
    ({ data, logo }, ref) => {
    
    // Use the first product's image as the primary image for the plan
    const primaryImage = data.products && data.products.length > 0 ? data.products[0].productImage : '';

    const totalQty = data.products.reduce((acc, p) => acc + p.qtyInContainer, 0);
    const freightCostPerUnit = totalQty > 0 ? data.freightTotal / totalQty : 0;
    const destinationCostPerUnit = totalQty > 0 ? data.destinationCostsTotal / totalQty : 0;

    const productsOnPage1 = data.products.slice(0, 1);
    const productsOnPage2 = data.products.slice(1);

    const renderProduct = (product: Product) => {
        const totalUnitCost = product.fobCostUnit + freightCostPerUnit + destinationCostPerUnit;
        const unitSalesMargin = product.estimatedSalesPrice - totalUnitCost;
        const grossSalesMarginPercent = product.estimatedSalesPrice > 0 ? (unitSalesMargin / product.estimatedSalesPrice) * 100 : 0;
        const grossMarkupPercent = totalUnitCost > 0 ? (unitSalesMargin / totalUnitCost) * 100 : 0;

        return (
            <FinancialTable key={product.id} title={`Product: ${product.nexstarModel}`}>
                {product.productImage && 
                    <div className="flex justify-between items-center py-2.5 border-b border-gray-200/80 text-base">
                            <span className="text-gray-500">Product Image</span>
                            <img src={product.productImage} alt={product.nexstarModel} className="h-16 w-16 object-cover rounded-md border p-1" />
                    </div>
                }
                <InfoItem label="Original Supplier" value={product.originalSupplier} />
                <InfoItem label="Supplier Reference" value={product.supplierReference} />
                <InfoItem label="Qty in Container" value={`${product.qtyInContainer.toLocaleString()} units`} />
                <div className="mt-4 pt-4 border-t border-dashed border-gray-300">
                    <h5 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Unit Economics</h5>
                    <InfoItem label="FOB Cost (Unit)" value={product.fobCostUnit} isCurrency />
                    <InfoItem label="Freight Cost (Unit)" value={freightCostPerUnit} isCurrency />
                    <InfoItem label="Destination Cost (Unit)" value={destinationCostPerUnit} isCurrency />
                    <InfoItem label="Total Unit Cost" value={totalUnitCost} isCurrency valueClass="font-bold text-gray-900" />
                    <InfoItem label="Sales Price (Unit)" value={product.estimatedSalesPrice} isCurrency />
                    <InfoItem label="Unit Sales Margin" value={unitSalesMargin} isCurrency />
                    <InfoItem label="Gross Sales Margin" value={grossSalesMarginPercent} isPercent />
                    <InfoItem label="Gross Markup" value={grossMarkupPercent} isPercent />
                </div>
            </FinancialTable>
        );
    };


    return (
        <div ref={ref} className="bg-surface text-text-primary p-10 sm:p-12 font-sans animate-slide-in-up" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* PAGE 1 CONTENT */}
            <div id="bp-page-1">
                <header className="mb-10 flex justify-between items-start">
                    <div>
                        {logo && <img src={logo} alt="Company Logo" className="h-12 object-contain mb-4" />}
                        <h1 className="text-4xl font-bold text-gray-800">Business Plan: {data.planName}</h1>
                        <p className="text-gray-500 mt-1">Financial Projections per Container</p>
                    </div>
                    {primaryImage &&
                        <img src={primaryImage} alt={data.planName} className="h-36 w-36 object-cover rounded-lg border p-1 shadow-sm" style={{maxWidth: '150px', maxHeight: '150px'}} />
                    }
                </header>

                <main>
                    <section className="mb-10">
                        <h2 className="text-xl font-semibold text-gray-700 mb-3">Executive Summary (AI-Generated)</h2>
                        <div className="bg-gray-50 border border-gray-200 p-5 rounded-lg">
                            <p className="text-gray-600 leading-relaxed text-base">{data.aiSummary || "No summary available."}</p>
                        </div>
                    </section>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 mb-12">
                        <div>
                            <h2 className="text-xl font-semibold mb-4 text-gray-700">Sales Overview</h2>
                            <div className="space-y-4">
                                <OverviewMetricCard title="Total Sales" value={`$${data.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} colorClass="bg-blue-50" />
                                <OverviewMetricCard title="Gross Profit (Total)" value={`$${data.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} colorClass="bg-green-50" />
                                <OverviewMetricCard title="Interest (15%)" value={`$${data.interest15Percent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} colorClass="bg-orange-50" />
                                <OverviewMetricCard title="Net Profit" value={`$${data.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} colorClass="bg-teal-50" />
                                <OverviewMetricCard title="Net Sales Margin" value={`${data.netSalesMarginPercent.toFixed(2)}%`} colorClass="bg-white" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold mb-4 text-gray-700">Cost Overview</h2>
                            <div className="space-y-4">
                                <OverviewMetricCard title="Total Investment" value={`$${data.totalInvestment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} colorClass="bg-red-50" />
                                <OverviewMetricCard title="Total Unit Cost (Avg.)" value={`$${data.totalUnitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} colorClass="bg-gray-100" />
                                <OverviewMetricCard title="Gross Markup" value={`${data.grossMarkupPercent.toFixed(2)}%`} colorClass="bg-white" />
                            </div>
                        </div>
                    </div>

                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">Products Breakdown & Unit Economics</h2>
                        {productsOnPage1.map(renderProduct)}
                    </section>
                </main>
            </div>

            {/* PAGE 2 CONTENT */}
            <div id="bp-page-2">
                 <main>
                    {productsOnPage2.length > 0 && (
                        <section>
                            <h2 className="text-2xl font-bold text-gray-800 my-6 border-b pb-3">Products Breakdown & Unit Economics (Cont.)</h2>
                            {productsOnPage2.map(renderProduct)}
                        </section>
                    )}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 my-6 border-b pb-3">Consolidated Financials</h2>
                        
                        <FinancialTable title="Container Economics (1 FCL)">
                            <InfoItem label="Total Investment" value={data.totalInvestment} isCurrency />
                            <InfoItem label="Total Sales" value={data.totalSales} isCurrency />
                            <InfoItem label="Total Profit" value={data.totalProfit} isCurrency />
                            <InfoItem label="Interest 15%" value={data.interest15Percent} isCurrency valueClass="text-danger" />
                            <InfoItem label="Net Profit" value={data.netProfit} isCurrency valueClass="font-bold text-accent" />
                            <InfoItem label="Net Sales Margin" value={data.netSalesMarginPercent} isPercent />
                            <InfoItem label="Net Markup (-15%)" value={data.netMarkupPercent} isPercent />
                        </FinancialTable>
                    </section>
                </main>
            </div>
        </div>
    );
});

export default BusinessPlan;