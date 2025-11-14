export interface BusinessPlanData {
  id: string;
  nexstarModel: string;
  supplierReference: string;
  originalSupplier: string;
  destination: string;
  containerType: string;
  qtyFCL: number;
  fobCostUnit: number;
  freightTotal: number;
  destinationCostsTotal: number;
  estimatedSalesPrice: number;
  productImage: string; // Base64 string for the image
  aiSummary: string;
  
  // These will be calculated and stored
  totalUnitCost: number;
  unitSalesMargin: number;
  grossSalesMarginPercent: number;
  grossMarkupPercent: number;
  netMarkupPercent: number;
  totalInvestment: number;
  totalSales: number;
  totalProfit: number;
  interest15Percent: number;
  netProfit: number;
  netSalesMarginPercent: number;
}

export type ViewType = 'plan' | 'po';
export type AppView = 'dashboard' | 'new_plan' | 'view_plan';