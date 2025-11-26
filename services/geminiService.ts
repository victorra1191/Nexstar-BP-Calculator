import { GoogleGenAI } from "@google/genai";
import type { BusinessPlanData } from '../types';

// Use the key provided by the user as a fallback if the environment variable is not set.
// This ensures functionality in environments like Vercel without manual env var configuration.
const FALLBACK_KEY = "AIzaSyACFbjUV1rG0UnB1n1h0UbHdabtS5xdqZ0";
const apiKey = process.env.API_KEY || FALLBACK_KEY;

const ai = new GoogleGenAI({ apiKey: apiKey });

// Safely log to help debug
if (!apiKey) {
    console.error("API_KEY is missing. AI features will not work.");
} else {
    // Log last 4 chars to verify which key is being used (safe log)
    console.log("API_KEY loaded.");
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