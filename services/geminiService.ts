
import { GoogleGenAI } from "@google/genai";
import type { BusinessPlanData } from '../types';

// Per @google/genai coding guidelines, the API key must be obtained exclusively from process.env.API_KEY.
// It is assumed to be pre-configured and accessible.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

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
        return "Failed to generate AI summary. Please check your API key and network connection.";
    }
};