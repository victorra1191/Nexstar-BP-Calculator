
import { GoogleGenAI } from "@google/genai";
import type { BusinessPlanData } from '../types';

// IMPORTANT: This check is to prevent crashing in environments where process.env is not defined.
const apiKey = typeof process !== 'undefined' && process.env && process.env.API_KEY
  ? process.env.API_KEY
  : undefined;

if (!apiKey) {
  console.warn("API_KEY environment variable not found. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export const generateBusinessPlanSummary = async (data: BusinessPlanData): Promise<string> => {
    if (!apiKey) {
        return Promise.resolve("AI functionality is disabled because the API key is missing.");
    }

    const prompt = `
        Generate a concise, professional executive summary for a business plan based on the following data for product model ${data.nexstarModel}.
        Focus on the key financial metrics like investment, projected sales, profit, and margins.
        The summary should be optimistic but grounded in the provided data. It should be one paragraph.

        Key Data:
        - Product Model: ${data.nexstarModel}
        - Total Investment (for one container): $${data.totalInvestment.toFixed(2)}
        - Projected Total Sales (for one container): $${data.totalSales.toFixed(2)}
        - Projected Net Profit (for one container): $${data.netProfit.toFixed(2)}
        - Net Sales Margin: ${data.netSalesMarginPercent.toFixed(2)}%
        - Gross Markup: ${data.grossMarkupPercent.toFixed(2)}%
        - Supplier: ${data.originalSupplier}
        - Destination Market: ${data.destination}

        Do not just list the numbers. Weave them into a compelling narrative about the business opportunity.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating summary:", error);
        return "Failed to generate AI summary. Please check your API key and network connection.";
    }
};
