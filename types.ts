

export interface Product {
  id: string;
  nexstarModel: string;
  supplierReference: string;
  originalSupplier: string;
  qtyInContainer: number;
  fobCostUnit: number;
  estimatedSalesPrice: number;
  productImage: string; // URL from Firebase Storage
  cbmPerUnit: number; // Cubic meters per unit for logistics calculation
}

export interface BusinessPlanData {
  id: string;
  planName: string;
  destination: string;
  containerType: string;
  containerCount?: number;
  freightTotal: number;
  destinationCostsTotal: number;
  products: Product[];
  aiSummary: string;
  aiSummaryChinese?: string; // To store the Chinese translation
  createdAt: string;
  updatedAt: string;
  
  // These will be calculated and stored
  totalUnitCost: number; // This becomes an aggregate/average concept
  unitSalesMargin: number; // Aggregate/average
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

export interface ExportHistoryItem {
  id: string;
  type: 'plan' | 'po';
  planModel: string; // Will now be planName
  poNumber?: string;
  containerCount?: number;
  exportedAt: string;
  status: 'pending' | 'approved' | 'disapproved';
  pdfStoragePath?: string; // Path in Firebase Storage where the PDF is stored
}

// New type for history items in the App's state, including the temporary display URL
export interface ExportHistoryItemWithUrl extends ExportHistoryItem {
  pdfDataUrl?: string | null; // Public URL for display, not for persistence
}

export interface UserData {
    plans: BusinessPlanData[];
    archivedPlans: BusinessPlanData[];
    logoStoragePath?: string; // Path in Storage for the logo
    poCounter: number;
    exportHistory: Omit<ExportHistoryItem, 'pdfStoragePath'>[]; // pdfDataUrl should not be stored directly here
}