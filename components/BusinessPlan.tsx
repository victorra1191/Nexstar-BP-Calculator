import React, { forwardRef } from 'react';
import type { BusinessPlanData } from '../types';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

const Section: React.FC<SectionProps> = ({ title, children, className = '' }) => (
  <div className={`mb-6 ${className}`}>
    <h3 className="text-xl font-semibold text-primary border-b-2 border-gray-200 pb-2 mb-4">{title}</h3>
    {children}
  </div>
);

interface InfoItemProps {
  label: string;
  value: string | number;
  isCurrency?: boolean;
}

const InfoItem: React.FC<InfoItemProps> = ({ label, value, isCurrency = false }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-gray-100 text-sm">
    <span className="text-text-secondary">{label}</span>
    <span className="font-medium font-mono text-text-primary">
      {isCurrency && typeof value === 'number' ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : value}
    </span>
  </div>
);

interface KeyMetricCardProps {
    label: string;
    value: string;
    icon: React.ReactNode;
}

const KeyMetricCard: React.FC<KeyMetricCardProps> = ({ label, value, icon }) => (
    <div className="bg-surface rounded-lg shadow-sm p-4 flex flex-col items-center justify-center text-center border">
        <div className="text-accent mb-2">{icon}</div>
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="text-xl font-bold text-primary">{value}</p>
    </div>
);

interface BusinessPlanProps {
    data: BusinessPlanData;
    logo: string;
}

const BusinessPlan = forwardRef<HTMLDivElement, BusinessPlanProps>(
    ({ data, logo }, ref) => {
    
    return (
        <div ref={ref} className="bg-surface p-8 sm:p-10 rounded-xl shadow-lg border animate-fade-in">
            <header className="flex justify-between items-center border-b-4 border-secondary pb-4 mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-primary">Business Plan</h1>
                    <p className="text-accent font-mono">MODEL: {data.nexstarModel}</p>
                </div>
                {logo ? <img src={logo} alt="Company Logo" className="h-16 object-contain" /> : <div className="h-16 w-32 bg-gray-200 rounded flex items-center justify-center text-sm text-gray-500">Your Logo</div>}
            </header>

            <main>
                <Section title="Executive Summary">
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <p className="text-gray-700 italic leading-relaxed">{data.aiSummary || "No summary available."}</p>
                    </div>
                </Section>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <KeyMetricCard label="Total Investment" value={`$${data.totalInvestment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
                    <KeyMetricCard label="Total Sales" value={`$${data.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
                    <KeyMetricCard label="Net Profit" value={`$${data.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>} />
                </div>
                
                 <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-2">
                         <Section title="Product Image">
                            <div className="aspect-w-1 aspect-h-1">
                                {data.productImage ? (
                                    <img src={data.productImage} alt="Product" className="w-full h-auto rounded-lg object-cover shadow-md border" />
                                ) : (
                                    <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                                        <p className="text-gray-500">No Image</p>
                                    </div>
                                )}
                            </div>
                        </Section>
                    </div>

                    <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div>
                            <Section title="Product & Logistics">
                                <InfoItem label="Nexstar Model" value={data.nexstarModel} />
                                <InfoItem label="Supplier" value={data.originalSupplier} />
                                <InfoItem label="Destination" value={data.destination} />
                                <InfoItem label="Container Type" value={data.containerType} />
                                <InfoItem label="Qty per Container" value={`${data.qtyFCL.toLocaleString()} units`} />
                            </Section>
                            <Section title="Cost Overview">
                                <InfoItem label="Unit FOB Cost" value={data.fobCostUnit} isCurrency />
                                <InfoItem label="Total Freight" value={data.freightTotal} isCurrency />
                                <InfoItem label="Destination Costs" value={data.destinationCostsTotal} isCurrency />
                                <InfoItem label="Total Unit Cost" value={data.totalUnitCost} isCurrency />
                            </Section>
                        </div>
                        <div>
                             <Section title="Sales & Margin">
                                <InfoItem label="Sales Price" value={data.estimatedSalesPrice} isCurrency />
                                <InfoItem label="Unit Margin" value={data.unitSalesMargin} isCurrency />
                                <InfoItem label="Gross Margin %" value={`${data.grossSalesMarginPercent.toFixed(1)}%`} />
                                <InfoItem label="Gross Markup %" value={`${data.grossMarkupPercent.toFixed(1)}%`} />
                                <InfoItem label="Net Markup %" value={`${data.netMarkupPercent.toFixed(1)}%`} />
                                <InfoItem label="Net Sales Margin %" value={`${data.netSalesMarginPercent.toFixed(2)}%`} />
                            </Section>
                             <Section title="Financials (per FCL)">
                                <InfoItem label="Investment" value={data.totalInvestment} isCurrency />
                                <InfoItem label="Sales" value={data.totalSales} isCurrency />
                                <InfoItem label="Profit" value={data.totalProfit} isCurrency />
                                <InfoItem label="Interest (15%)" value={data.interest15Percent} isCurrency />
                                <InfoItem label="Net Profit" value={data.netProfit} isCurrency />
                            </Section>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
});

export default BusinessPlan;