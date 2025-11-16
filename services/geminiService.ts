
import { GoogleGenAI, Type } from "@google/genai";
import type { BusinessPlanData } from '../types';

// The API key is injected from the environment variable `process.env.API_KEY`.
// The application must not ask the user for it.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateBusinessPlanSummary = async (data: BusinessPlanData): Promise<string> => {
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
        return response.text;
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
        return response.text;
    } catch (error) {
        console.error("Error translating text:", error);
        return "Translation failed. Please check your API key and network connection.";
    }
};

export const parseBusinessPlanFromText = async (text: string): Promise<string> => {
    const prompt = `
        Analyze the following text extracted from a business plan PDF. Your task is to act as a data extraction engine and convert the information into a structured JSON object.
        The JSON object must strictly conform to the structure of the Omit<BusinessPlanData, 'id' | 'aiSummary' | 'createdAt' | 'updatedAt'> type provided below.
        Pay close attention to identifying all products listed, their individual properties (model, supplier, quantity, costs), and the overall container details.
        Calculate the financial totals based on the product data if they are not explicitly mentioned.

        Here is the target JSON structure:
        interface Product {
            id: string; // Generate a new unique ID, e.g., "product_" + timestamp
            nexstarModel: string;
            supplierReference: string;
            originalSupplier: string;
            qtyInContainer: number;
            fobCostUnit: number;
            estimatedSalesPrice: number;
            productImage: string; // Leave this as an empty string: ""
        }
        
        interface BusinessPlanData {
            planName: string;
            destination: string;
            containerType: string;
            freightTotal: number;
            destinationCostsTotal: number;
            products: Product[];
        }

        - Infer numeric values from text (e.g., "$1,234.56" should become 1234.56).
        - If a value is not found, use a reasonable default (e.g., 0 for numbers, "" for strings).
        - The 'planName' is usually in the main title.
        - The products are typically in a "Products Breakdown" section.

        Now, parse this text:
        ---
        ${text}
        ---
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // Using a more powerful model for better parsing accuracy
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        // Clean the response to ensure it's valid JSON
        let jsonString = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        return jsonString;
    } catch (error) {
        console.error("Error parsing business plan from text:", error);
        throw new Error("AI failed to parse the document. The PDF might be image-based or have an unusual format.");
    }
};