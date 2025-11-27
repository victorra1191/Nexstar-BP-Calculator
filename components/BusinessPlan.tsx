
import React, { forwardRef, useState } from 'react';
import type { BusinessPlanData, Product } from '../types';

const translations = {
    en: {
        businessPlan: 'Business Plan',
        financialProjections: 'Financial Projections per Container',
        executiveSummary: 'Executive Summary (AI-Generated)',
        salesOverview: 'Sales Overview',
        totalSales: 'Total Sales',
        grossProfit: 'Gross Profit (Total)',
        interest: 'Interest (15%)',
        netProfit: 'Net Profit',
        netSalesMargin: 'Net Sales Margin',
        costOverview: 'Cost Overview',
        totalInvestment: 'Total Investment',
        avgUnitCost: 'Total Unit Cost (Avg.)',
        grossMarkup: 'Gross Markup',
        productsBreakdown: 'Products Breakdown & Unit Economics',
        productsBreakdownCont: 'Products Breakdown & Unit Economics (Cont.)',
        consolidatedFinancials: 'Consolidated Financials',
        containerEconomics: 'Container Economics (1 FCL)',
        interest15: 'Interest 15%',
        netMarkup: 'Net Markup (-15%)',
        product: 'Product',
        productImage: 'Product Image',
        originalSupplier: 'Original Supplier',
        supplierReference: 'Supplier Reference',
        qtyInContainer: 'Qty in Container',
        unitEconomics: 'Unit Economics',
        fobCost: 'FOB Cost (Unit)',
        freightCost: 'Freight Cost (Unit)',
        destinationCost: 'Destination Cost (Unit)',
        totalUnitCost: 'Total Unit Cost',
        salesPrice: 'Sales Price (Unit)',
        unitSalesMargin: 'Unit Sales Margin',
        grossSalesMargin: 'Gross Sales Margin',
    },
    zh: {
        businessPlan: '商业计划书',
        financialProjections: '每个集装箱的财务预测',
        executiveSummary: '执行摘要 (AI 生成)',
        salesOverview: '销售概览',
        totalSales: '总销售额',
        grossProfit: '毛利润 (总计)',
        interest: '利息 (15%)',
        netProfit: '净利润',
        netSalesMargin: '净销售利润率',
        costOverview: '成本概览',
        totalInvestment: '总投资',
        avgUnitCost: '总单位成本 (平均)',
        grossMarkup: '毛利率',
        productsBreakdown: '产品分解与单位经济效益',
        productsBreakdownCont: '产品分解与单位经济效益 (续)',
        consolidatedFinancials: '综合财务',
        containerEconomics: '集装箱经济效益 (1 FCL)',
        interest15: '利息 15%',
        netMarkup: '净加成率 (-15%)',
        product: '产品',
        productImage: '产品图片',
        originalSupplier: '原始供应商',
        supplierReference: '供应商参考',
        qtyInContainer: '集装箱内数量',
        unitEconomics: '单位经济效益',
        fobCost: '离岸价成本 (单位)',
        freightCost: '运费成本 (单位)',
        destinationCost: '目的地成本 (单位)',
        totalUnitCost: '总单位成本',
        salesPrice: '销售价格 (单位)',
        unitSalesMargin: '单位销售利润',
        grossSalesMargin: '毛销售利润率',
    }
};


const InfoItem: React.FC<{ label: string; value: string | number; isCurrency?: boolean; isPercent?: boolean; valueClass?: string; }> = ({ label, value, isCurrency = false, isPercent = false, valueClass = 'text-gray-800' }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-gray-200/80 text-base">
    <span className="text-gray-500">{label}</span>
    <span className={`font-medium ${valueClass}`}>
      {isCurrency && typeof value === 'number'
        ? `$${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : isPercent && typeof value === 'number'
        ? `${(value || 0).toFixed(2)}%`
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
    isGeneratingSummary: boolean;
    isTranslating: boolean;
    onRetrySummary: () => void;
    onTranslateSummary: () => void;
    languageOverride?: 'en' | 'zh';
}

const BusinessPlan = forwardRef<HTMLDivElement, BusinessPlanProps>(
    ({ data, logo, isGeneratingSummary, isTranslating, onRetrySummary, onTranslateSummary, languageOverride }, ref) => {
    
    const [language, setLanguage] = useState<'en' | 'zh'>('en');

    const displayLanguage = languageOverride || language;
    const T = translations[displayLanguage];

    const primaryImage = data.products && data.products.length > 0 ? data.products[0].productImage : '';
    
    // Calculate totalQty and totalCbm for the entire plan, as they are used in both original and new proportional freight calculations
    const totalQtyInPlan = data.products.reduce((acc, p) => acc + (p.qtyInContainer || 0), 0);
    const totalCbmInPlan = data.products.reduce((acc, p) => acc + ((p.qtyInContainer || 0) * (p.cbmPerUnit || 0)), 0);

    const productsOnPage1 = data.products.slice(0, 1);
    const productsOnPage2 = data.products.slice(1);

    const TOTAL_CONTAINER_NOMINAL_CBM = 66; // Constant as per user's formula for consolidated freight calculation

    const renderProduct = (product: Product) => {
        let freightAllocatedPerUnit = 0;
        let destAllocatedPerUnit = 0;
        const qty = product.qtyInContainer || 0;

        console.log(`[Freight Calc] Product: ${product.nexstarModel}, CBM/Unit: ${product.cbmPerUnit}, Qty: ${qty}, FreightTotal: ${data.freightTotal}`);

        // Conditional logic for freight allocation based on consolidated vs. single product
        if (data.products.length > 1) { // Consolidated Logic (apply new formula adjusted for unit cost)
            console.log(`[Freight Calc - Consolidated] Applying new formula for consolidated plan.`);
            // Formula breakdown:
            // 1. Calculate total freight allocated to this specific product based on its CBM proportion of a nominal container size.
            const totalFreightForThisProduct = ((product.cbmPerUnit || 0) / TOTAL_CONTAINER_NOMINAL_CBM) * (data.freightTotal || 0);
            console.log(`[Freight Calc - Consolidated] Total Freight for Product (${product.nexstarModel}): $${totalFreightForThisProduct.toFixed(2)}`);

            // 2. Divide that total freight by the quantity of this specific product to get the unit cost.
            freightAllocatedPerUnit = qty > 0 ? totalFreightForThisProduct / qty : 0;
            console.log(`[Freight Calc - Consolidated] Unit Freight for Product (${product.nexstarModel}): $${freightAllocatedPerUnit.toFixed(2)} ($${totalFreightForThisProduct.toFixed(2)} / ${qty} units)`);

        } else { // Single Product Logic (revert to original proportional logic, which simplifies for a single product)
            console.log(`[Freight Calc - Single Product] Applying original proportional logic.`);
            if (totalQtyInPlan > 0) {
                // For a single product plan, total freight is just divided by its total quantity
                freightAllocatedPerUnit = (data.freightTotal || 0) / totalQtyInPlan;
                console.log(`[Freight Calc - Single Product] Unit Freight for Product (${product.nexstarModel}): $${freightAllocatedPerUnit.toFixed(2)} ($${(data.freightTotal || 0).toFixed(2)} / ${totalQtyInPlan} units)`);
            } else {
                freightAllocatedPerUnit = 0;
                console.log(`[Freight Calc - Single Product] Unit Freight for Product (${product.nexstarModel}): $0.00 (Total Qty is zero)`);
            }
        }
        
        // Destination costs distribution remains proportional by CBM (if available), or by quantity (fallback)
        if (totalCbmInPlan > 0 && (product.cbmPerUnit || 0) > 0) {
             const productTotalCbm = qty * (product.cbmPerUnit || 0);
             const shareOfContainer = productTotalCbm / totalCbmInPlan;
             const totalDestForProduct = (data.destinationCostsTotal || 0) * shareOfContainer;
             destAllocatedPerUnit = qty > 0 ? totalDestForProduct / qty : 0;
        } else {
             // Fallback: Average per unit
             destAllocatedPerUnit = totalQtyInPlan > 0 ? (data.destinationCostsTotal || 0) / totalQtyInPlan : 0;
        }

        const totalUnitCost = (product.fobCostUnit || 0) + freightAllocatedPerUnit + destAllocatedPerUnit;
        const unitSalesMargin = (product.estimatedSalesPrice || 0) - totalUnitCost;
        const grossSalesMarginPercent = (product.estimatedSalesPrice || 0) > 0 ? (unitSalesMargin / product.estimatedSalesPrice) * 100 : 0;
        const grossMarkupPercent = totalUnitCost > 0 ? (unitSalesMargin / totalUnitCost) * 100 : 0;

        console.log(`[Freight Calc - Final] ${product.nexstarModel} -> Freight Allocated Per Unit: $${freightAllocatedPerUnit.toFixed(2)}`);

        return (
            <FinancialTable key={product.id} title={`${T.product}: ${product.nexstarModel}`}>
                {product.productImage && 
                    <div className="flex justify-between items-center py-2.5 border-b border-gray-200/80 text-base">
                            <span className="text-gray-500">{T.productImage}</span>
                            <img src={product.productImage} alt={product.nexstarModel} className="h-16 w-16 object-cover rounded-md border p-1" />
                    </div>
                }
                <InfoItem label={T.originalSupplier} value={product.originalSupplier} />
                <InfoItem label={T.supplierReference} value={product.supplierReference} />
                <InfoItem label={T.qtyInContainer} value={`${qty.toLocaleString()} units`} />
                {product.cbmPerUnit !== null && product.cbmPerUnit !== undefined && <InfoItem label="CBM Per Unit" value={`${(product.cbmPerUnit || 0).toFixed(3)} m³`} />}
                <div className="mt-4 pt-4 border-t border-dashed border-gray-300">
                    <h5 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">{T.unitEconomics}</h5>
                    <InfoItem label={T.fobCost} value={product.fobCostUnit} isCurrency />
                    <InfoItem label={T.freightCost} value={freightAllocatedPerUnit} isCurrency />
                    <InfoItem label={T.destinationCost} value={destAllocatedPerUnit} isCurrency />
                    <InfoItem label={T.totalUnitCost} value={totalUnitCost} isCurrency valueClass="font-bold text-gray-900" />
                    <InfoItem label={T.salesPrice} value={product.estimatedSalesPrice} isCurrency />
                    <InfoItem label={T.unitSalesMargin} value={unitSalesMargin} isCurrency />
                    <InfoItem label={T.grossSalesMargin} value={grossSalesMarginPercent} isPercent />
                    <InfoItem label={T.grossMarkup} value={grossMarkupPercent} isPercent />
                </div>
            </FinancialTable>
        );
    };

    const renderSummaryContent = () => {
        if (isGeneratingSummary) {
            return (
                <div className="flex flex-col items-center text-center">
                    <svg className="animate-spin h-8 w-8 text-primary mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-600 leading-relaxed text-base">Generating AI Summary...</p>
                </div>
            );
        }

        if (data.aiSummary && data.aiSummary.startsWith('Failed to generate')) {
            return (
                <div className="text-center text-sm">
                    <p className="text-danger font-semibold mb-2">{data.aiSummary}</p>
                    <button onClick={onRetrySummary} className="bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-hover transition-colors">
                        Retry
                    </button>
                </div>
            );
        }

        if (displayLanguage === 'zh') {
            if (isTranslating) {
                 return (
                    <div className="flex flex-col items-center text-center">
                        <svg className="animate-spin h-8 w-8 text-primary mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-gray-600 leading-relaxed text-base">Translating to Chinese...</p>
                    </div>
                );
            }
            if (data.aiSummaryChinese && !data.aiSummaryChinese.startsWith('Translation failed')) {
                return <p className="text-gray-600 leading-relaxed text-base font-sans break-words">{data.aiSummaryChinese}</p>;
            }
            // Display translation error if it exists, otherwise the 'No Chinese translation' message
            if (data.aiSummaryChinese && data.aiSummaryChinese.startsWith('Translation failed')) {
                 return (
                    <div className="text-center text-sm">
                        <p className="text-danger font-semibold mb-2 break-words">{data.aiSummaryChinese}</p>
                        <button onClick={onTranslateSummary} className="bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-hover transition-colors">
                            Retry
                        </button>
                    </div>
                 );
            }
            return (
                <div className="text-center">
                    <p className="text-gray-500 mb-4">No Chinese translation available for this summary.</p>
                    <button onClick={onTranslateSummary} className="bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-hover transition-colors">
                        Translate to Chinese
                    </button>
                </div>
            );
        }

        return <p className="text-gray-600 leading-relaxed text-base break-words">{data.aiSummary || "No summary available."}</p>;
    };


    return (
        <div ref={ref} className="bg-surface text-text-primary p-10 sm:p-12 font-sans animate-slide-in-up" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* PAGE 1 CONTENT */}
            <div id="bp-page-1">
                <header className="mb-10 flex justify-between items-start">
                    <div>
                        {logo && <img src={logo} alt="Company Logo" className="h-24 object-contain mb-4" />}
                        <h1 className="text-4xl font-bold text-gray-800">{T.businessPlan}: {data.planName}</h1>
                        <p className="text-gray-500 mt-1">{T.financialProjections}</p>
                    </div>
                    {primaryImage &&
                        <img src={primaryImage} alt={data.planName} className="h-36 w-36 object-cover rounded-lg border p-1 shadow-sm" style={{maxWidth: '150px', maxHeight: '150px'}} />
                    }
                </header>

                <main>
                    <section className="mb-10">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-xl font-semibold text-gray-700">{T.executiveSummary}</h2>
                             {!languageOverride && (
                                <div className="bg-secondary p-1 rounded-lg flex space-x-1">
                                    <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${language === 'en' ? 'bg-primary text-white shadow' : 'text-text-primary hover:bg-white/60'}`}>English</button>
                                    <button onClick={() => setLanguage('zh')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${language === 'zh' ? 'bg-primary text-white shadow' : 'text-text-primary hover:bg-white/60'}`}>Chinese</button>
                                </div>
                             )}
                        </div>
                        <div className="bg-gray-50 border border-gray-200 p-5 rounded-lg min-h-[120px] flex items-center justify-center">
                           {renderSummaryContent()}
                        </div>
                    </section>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 mb-12">
                        <div>
                            <h2 className="text-xl font-semibold mb-4 text-gray-700">{T.salesOverview}</h2>
                            <div className="space-y-4">
                                <OverviewMetricCard title={T.totalSales} value={`$${(data.totalSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} colorClass="bg-blue-50" />
                                <OverviewMetricCard title={T.grossProfit} value={`$${(data.totalProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} colorClass="bg-green-50" />
                                <OverviewMetricCard title={T.interest} value={`$${(data.interest15Percent || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} colorClass="bg-orange-50" />
                                <OverviewMetricCard title={T.netProfit} value={`$${(data.netProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} colorClass="bg-teal-50" />
                                <OverviewMetricCard title={T.netSalesMargin} value={`${(data.netSalesMarginPercent || 0).toFixed(2)}%`} colorClass="bg-white" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold mb-4 text-gray-700">{T.costOverview}</h2>
                            <div className="space-y-4">
                                <OverviewMetricCard title={T.totalInvestment} value={`$${(data.totalInvestment || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} colorClass="bg-red-50" />
                                <OverviewMetricCard title={T.avgUnitCost} value={`$${(data.totalUnitCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} colorClass="bg-gray-100" />
                                <OverviewMetricCard title={T.grossMarkup} value={`${(data.grossMarkupPercent || 0).toFixed(2)}%`} colorClass="bg-white" />
                            </div>
                        </div>
                    </div>

                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">{T.productsBreakdown}</h2>
                        {productsOnPage1.map(renderProduct)}
                    </section>
                </main>
            </div>

            {/* PAGE 2 CONTENT */}
            <div id="bp-page-2">
                 <main>
                    {productsOnPage2.length > 0 && (
                        <section>
                            <h2 className="text-2xl font-bold text-gray-800 my-6 border-b pb-3">{T.productsBreakdownCont}</h2>
                            {productsOnPage2.map(renderProduct)}
                        </section>
                    )}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 my-6 border-b pb-3">{T.consolidatedFinancials}</h2>
                        
                        <FinancialTable title={T.containerEconomics}>
                            <InfoItem label={T.totalInvestment} value={data.totalInvestment} isCurrency />
                            <InfoItem label={T.totalSales} value={data.totalSales} isCurrency />
                            <InfoItem label={T.grossProfit} value={data.totalProfit} isCurrency />
                            <InfoItem label={T.interest15} value={data.interest15Percent} isCurrency valueClass="text-danger" />
                            <InfoItem label={T.netProfit} value={data.netProfit} isCurrency valueClass="font-bold text-accent" />
                            <InfoItem label={T.netSalesMargin} value={data.netSalesMarginPercent} isPercent />
                            <InfoItem label={T.netMarkup} value={data.netMarkupPercent} isPercent />
                        </FinancialTable>
                    </section>
                </main>
            </div>
        </div>
    );
});

export default BusinessPlan;
