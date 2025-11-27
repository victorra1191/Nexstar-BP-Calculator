import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import type { BusinessPlanData } from '../types';

// Access the API key from Vite environment variables (Vercel)
// This `process.env.API_KEY` is defined in vite.config.ts to take VITE_API_KEY
const apiKey = process.env.API_KEY;

// Initialize conditionally to prevent crash if key is somehow missing
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateBusinessPlanSummary = async (data: BusinessPlanData): Promise<string> => {
    if (!ai || !apiKey) {
        console.error("[Gemini Error] API Key is missing for summary generation.");
        return "Failed: API Key is missing. Please configure VITE_API_KEY in Vercel Environment Variables and Redeploy.";
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

    console.log("[Gemini] Sending summary prompt:", prompt);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ]
            }
        });
        const summaryText = response.text;
        console.log("[Gemini] Summary response received:", summaryText);
        return summaryText || "No summary generated.";
    } catch (error: any) {
        console.error("[Gemini Error] Error generating summary:", error);
        
        const errorMsg = error.message || String(error);

        // Handle specific Google API errors to provide actionable feedback
        if (errorMsg.includes('API_KEY_SERVICE_BLOCKED') || errorMsg.includes('GenerativeService.GenerateContent are blocked')) {
            return "Failed: The API Key needs permission. Go to Google Cloud Console > Credentials > Edit Key > API Restrictions, and add 'Generative Language API' to the list. (Changes take 5 mins)";
        }
        
        if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('403')) {
            return "Failed: Access denied. Please check your API Key Restrictions in Google Cloud Console. Ensure 'Generative Language API' is checked. (Changes take 5 mins)";
        }
        
        if (errorMsg.includes('unauthorized domain') || errorMsg.includes('domain restriction')) {
            return "Failed: Access denied due to domain restrictions. In Google Cloud Console > Credentials > Edit Key > Application Restrictions (Websites), add your Vercel domain (e.g., https://your-app.vercel.app) or temporary 'None' restriction for debugging.";
        }
        
        if (errorMsg.includes('429') || errorMsg.includes('quota')) {
            return "Failed: Quota exceeded. Please try again later.";
        }

        return `Failed to generate summary: ${errorMsg}`;
    }
};

export const translateTextToChinese = async (textToTranslate: string): Promise<string> => {
    if (!ai || !apiKey) {
        console.error("[Gemini Error] API Key is missing for translation.");
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

    console.log("[Gemini] Sending translation prompt for text:", textToTranslate.substring(0, 100) + "...");

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ]
            }
        });
        const translatedText = response.text;
        console.log("[Gemini] Translation response received:", translatedText);
        return translatedText || "Translation failed.";
    } catch (error: any) {
        console.error("[Gemini Error] Error translating text:", error);
        const errorMsg = error.message || String(error);
        
        if (errorMsg.includes('API_KEY_SERVICE_BLOCKED') || errorMsg.includes('PERMISSION_DENIED')) {
             return "Translation failed: Check API Key Restrictions in Google Cloud. (Changes take 5 mins)";
        }

        if (errorMsg.includes('unauthorized domain') || errorMsg.includes('domain restriction')) {
            return "Translation failed: Access denied due to domain restrictions. In Google Cloud Console > Credentials > Edit Key > Application Restrictions (Websites), add your Vercel domain (e.g., https://your-app.vercel.app) or temporary 'None' restriction for debugging.";
        }
        
        return "Translation failed. Please try again.";
    }
};