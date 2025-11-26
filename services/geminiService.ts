import { GoogleGenAI } from "@google/genai";
import type { BusinessPlanData } from '../types';

// The API key is injected from the environment variable `process.env.API_KEY`.
// The application must not ask the user for it.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Safely log to help debug if the key is missing (masked)
const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.error("API_KEY is missing. AI features will not work.");
} else {
    console.log("API_KEY loaded (ends with):", apiKey.slice(-4));
}


export const generateBusinessPlanSummary = async (data: BusinessPlanData): Promise<string> => {
    if (!apiKey) {
        return "API Key is missing. Please configure VITE_API_KEY in your environment.";
    }

    const productList = data.products.map(p => `- ${p.nexstarModel} (${p.qtyInContainer} units)`).join('\n');

    const prompt = `
        Generate a concise, professional executive summary for a business plan for a consolidated container based on the following data. The plan is named "${data.planName}".
        Assume the role of a financial analyst presenting to potential investors. Go beyond the surface-level data to provide a brief analysis of what these numbers signify (e.g., strong profitability from a diversified product mix, efficient cost management, high-return potential).
        The summary should be optimistic but grounded in the provided data. It should be one paragraph.
        The tone should be confident, analytical, and persuasive.

        Key Aggregated Data:
        - Total Investment (for one container): $${data.totalInvestment.toFixed(2)}
        - Projected Total Sales (for one container): $${data.totalSales.toFixed(2)}
        - Projected Net Profit (for one container): $${data.netProfit.toFixed(2)}
        - Net Sales Margin: ${data.netSalesMarginPercent.toFixed(2)}%
        - Gross Markup: ${data.grossMarkupPercent.toFixed(2)}%
        - Destination Market: ${data.destination}

        Products in Container:
        ${productList}

        Weave the key data into a compelling narrative about this consolidated shipment as a business opportunity. Do not just list the numbers.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || "No summary generated.";
    } catch (error) {
        console.error("Error generating summary:", error);
        // Provide a more specific error message if it's likely an auth/billing issue.
        if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('billing'))) {
             return "Failed to generate AI summary. The API key is invalid or billing is not enabled for the project. Please verify your Google Cloud configuration.";
        }
        return "Failed to generate AI summary. Please check your API key and network connection.";
    }
};

export const translateTextToChinese = async (textToTranslate: string): Promise<string> => {
    if (!apiKey) {
        return "Translation failed: API Key is missing.";
    }

    const prompt = `
        Translate the following English executive summary into Simplified Chinese (简体中文).
        Maintain a professional, formal, and financial tone suitable for a business plan.
        Ensure the translation is accurate and fluent.

        English Text:
        ---
        ${textToTranslate}
        ---
        
        Chinese Translation:
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || "Translation failed.";
    } catch (error) {
        console.error("Error translating text:", error);
        return "Translation failed. Please check your API key and network connection.";
    }
};

const EXTRACTION_PROMPT_INSTRUCTIONS = `
    Your task is to act as a data extraction engine and convert the information into a structured JSON object.
    The JSON object must strictly conform to the structure of the Omit<BusinessPlanData, 'id' | 'aiSummary' | 'createdAt' | 'updatedAt'> type provided below.
    
    This document may be a purchase order, an invoice, or a packing list. Extract as much relevant information as possible.
    Pay close attention to identifying all products listed.

    Here is the target JSON structure:
    interface Product {
        id: string; // Generate a new unique ID, e.g., "product_" + timestamp + random
        nexstarModel: string; // Use the Model Number or SKU. If missing, use a generic name like "Item 1".
        supplierReference: string; // Any other reference code, or repeat the model.
        originalSupplier: string; // The company name found in the header or footer.
        qtyInContainer: number; // Default to 1 if not found.
        fobCostUnit: number; // Unit Price. Default to 0 if not found.
        estimatedSalesPrice: number; // Calculate as (Unit Price * 1.5) if not found.
        productImage: string; // Leave this as an empty string: ""
        cbmPerUnit: number; // Volume per unit in cubic meters (e.g., 0.05). Default to 0 if not found.
    }
    
    interface BusinessPlanData {
        planName: string; // Infer from document title or use "Imported Plan" if not found
        destination: string; // Look for "Ship To" or address. Default "Warehouse" if not found.
        containerType: string; // Default to "40' HC" if not found
        freightTotal: number; // Look for "Freight" or default to 5000
        destinationCostsTotal: number; // Default to 500 if not found
        products: Product[]; // MUST NOT BE EMPTY. If no specific products are found, create one placeholder product with available info or generic defaults.
    }

    Important Rules:
    - Infer numeric values from text (e.g., "$1,234.56" should become 1234.56).
    - Be flexible. If you see a table, rows are likely products.
    - If specific fields like 'cbmPerUnit' are missing, set them to 0.
    - DO NOT return an empty 'products' array. If extraction fails, return a single product named "Unidentified Product" so the user can edit it later.
    - Ensure valid JSON output.
`;

export const parseBusinessPlanFromText = async (text: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("API Key is missing. Cannot parse document.");
    }

    const prompt = `
        Analyze the following text extracted from a business plan PDF.
        ${EXTRACTION_PROMPT_INSTRUCTIONS}

        Now, parse this text:
        ---
        ${text}
        ---
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Using a flash model for JSON tasks
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        // Clean the response to ensure it's valid JSON
        let jsonString = (response.text || "").replace(/```json/g, '').replace(/```/g, '').trim();
        return jsonString;
    } catch (error) {
        console.error("Error parsing business plan from text:", error);
        throw new Error("AI failed to parse the document. The PDF might be image-based or have an unusual format.");
    }
};

export const parseBusinessPlanFromImages = async (images: string[]): Promise<string> => {
    if (!apiKey) {
        throw new Error("API Key is missing. Cannot parse document.");
    }

    const prompt = `
        Analyze the provided images of a business document.
        ${EXTRACTION_PROMPT_INSTRUCTIONS}
    `;

    const parts = [
        { text: prompt },
        ...images.map(img => ({
            inlineData: {
                mimeType: 'image/jpeg',
                data: img
            }
        }))
    ];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: {
                responseMimeType: "application/json",
            }
        });

        let jsonString = (response.text || "").replace(/```json/g, '').replace(/```/g, '').trim();
        return jsonString;
    } catch (error) {
        console.error("Error parsing business plan from images:", error);
        throw new Error("AI failed to parse the scanned document.");
    }
};
