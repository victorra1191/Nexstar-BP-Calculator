import { GoogleGenAI } from "@google/genai";
import type { BusinessPlanData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateBusinessPlanSummary = async (data: BusinessPlanData): Promise<string> => {
    if (!process.env.API_KEY) {
        return "Failed: API Key is missing. Please configure process.env.API_KEY.";
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
    } catch (error: any) {
        console.error("Error generating summary:", error);
        
        const errorMsg = error.message || String(error);

        // Handle specific Google API errors to provide actionable feedback
        if (errorMsg.includes('API_KEY_SERVICE_BLOCKED') || errorMsg.includes('GenerativeService.GenerateContent are blocked')) {
            return "Failed: The API Key is valid, but the 'Generative Language API' is disabled in Google Cloud Console. Please enable it.";
        }
        
        if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('403')) {
            return "Failed: Access forbidden. Please check your API Key restrictions.";
        }
        
        if (errorMsg.includes('429') || errorMsg.includes('quota')) {
            return "Failed: Quota exceeded. Please try again later.";
        }

        return "Failed to generate AI summary. Please check console for details.";
    }
};

export const translateTextToChinese = async (textToTranslate: string): Promise<string> => {
    if (!process.env.API_KEY) {
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
    } catch (error: any) {
        console.error("Error translating text:", error);
        const errorMsg = error.message || String(error);
        
        if (errorMsg.includes('API_KEY_SERVICE_BLOCKED')) {
             return "Translation failed: Generative Language API is disabled.";
        }
        
        return "Translation failed. Please try again.";
    }
};