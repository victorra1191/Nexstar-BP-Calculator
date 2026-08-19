import type { BusinessPlanData } from '../types';

export const generateBusinessPlanSummary = async (data: BusinessPlanData): Promise<string> => {
    console.log("[Gemini] Requesting summary generation from server");

    try {
        const response = await fetch('/api/gemini/summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Unknown error');
        }

        console.log("[Gemini] Summary response received from server");
        return result.summary || "No summary generated.";
    } catch (error: any) {
        console.error("[Gemini Error] Error requesting summary:", error);
        
        const errorMsg = error.message || String(error);

        // Handle specific Google API errors to provide actionable feedback
        if (errorMsg.includes('API_KEY_SERVICE_BLOCKED') || errorMsg.includes('GenerativeService.GenerateContent are blocked')) {
            return "Failed: The Gemini API Key needs permission. Go to Google Cloud Console > Credentials > Edit Key > API Restrictions, and add 'Generative Language API' to the list. (Changes take 5 mins)";
        }
        
        if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('403')) {
            if (errorMsg.includes('leaked')) {
                return "Failed: Your Gemini API Key was reported as leaked. Please generate a new key and update VITE_GEMINI_API_KEY in Vercel. (Changes take 5 mins)";
            }
            return "Failed: Access denied for Gemini API. Please check your Gemini API Key Restrictions in Google Cloud Console. Ensure 'Generative Language API' is checked. (Changes take 5 mins)";
        }
        
        if (errorMsg.includes('unauthorized domain') || errorMsg.includes('domain restriction')) {
            return "Failed: Access denied due to domain restrictions for Gemini API. In Google Cloud Console > Credentials > Edit Key > Application Restrictions (Websites), add your Vercel domain (e.g., https://your-app.vercel.app) or temporary 'None' restriction for debugging.";
        }
        
        if (errorMsg.includes('429') || errorMsg.includes('quota')) {
            return "Failed: Quota exceeded for Gemini API. Please try again later.";
        }

        return `Failed to generate summary: ${errorMsg}`;
    }
};

export const translateTextToChinese = async (textToTranslate: string): Promise<string> => {
    console.log("[Gemini] Requesting translation from server for text:", textToTranslate.substring(0, 100) + "...");

    try {
        const response = await fetch('/api/gemini/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ textToTranslate })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Unknown error');
        }

        console.log("[Gemini] Translation response received from server");
        return result.translatedText || "Translation failed.";
    } catch (error: any) {
        console.error("[Gemini Error] Error requesting translation:", error);
        const errorMsg = error.message || String(error);
        
        if (errorMsg.includes('API_KEY_SERVICE_BLOCKED') || errorMsg.includes('PERMISSION_DENIED')) {
             return "Translation failed: Check Gemini API Key Restrictions in Google Cloud. (Changes take 5 mins)";
        }

        if (errorMsg.includes('unauthorized domain') || errorMsg.includes('domain restriction')) {
            return "Translation failed: Access denied due to domain restrictions for Gemini API. In Google Cloud Console > Credentials > Edit Key > Application Restrictions (Websites), add your Vercel domain (e.g., https://your-app.vercel.app) or temporary 'None' restriction for debugging.";
        }
        
        return "Translation failed. Please try again.";
    }
};