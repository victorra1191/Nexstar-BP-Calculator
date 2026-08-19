import express from "express";
import { Pool } from "pg";
import cors from "cors";
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Need large limit for base64 files
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Connect to Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_6J4GjkFrvBdx@ep-round-mouse-atdsz5ak-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
});

// Initialize DB schema
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          data JSONB
      );
      CREATE TABLE IF NOT EXISTS files (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255),
          data_base64 TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database initialized");
  } catch (err) {
    console.error("Failed to initialize DB", err);
  }
}

initDb();

// --- API ROUTES ---

// Get User Data
app.get("/api/user/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const result = await pool.query("SELECT data FROM users WHERE id = $1", [uid]);
    if (result.rows.length > 0) {
      res.json(result.rows[0].data);
    } else {
      res.json(null);
    }
  } catch (err) {
    console.error("Error fetching user data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Save User Data
app.post("/api/user/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const newData = req.body;
    
    // Merge data similar to Firestore { merge: true }
    const existing = await pool.query("SELECT data FROM users WHERE id = $1", [uid]);
    let mergedData = newData;
    
    if (existing.rows.length > 0 && existing.rows[0].data) {
      mergedData = { ...existing.rows[0].data, ...newData };
    }

    await pool.query(
      "INSERT INTO users (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2",
      [uid, mergedData]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error saving user data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Upload File to Cloudinary
app.post("/api/files", async (req, res) => {
  try {
    const { uid, base64Data } = req.body;
    if (!uid || !base64Data) {
      return res.status(400).json({ error: "Missing uid or base64Data" });
    }
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: 'Nexstar',
    });
    
    // Return the secure URL directly
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error("Error uploading file to Cloudinary:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Download File (Not needed if URL is direct Cloudinary, but left for backwards compat)
app.get("/api/files/download/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const result = await pool.query("SELECT data_base64 FROM files WHERE id = $1", [fileId]);
    if (result.rows.length > 0) {
      const base64Data = result.rows[0].data_base64;
      res.json({ data: base64Data });
    } else {
      res.status(404).send("File not found");
    }
  } catch (err) {
    console.error("Error downloading file:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Delete File
app.delete("/api/files/download/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    await pool.query("DELETE FROM files WHERE id = $1", [fileId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting file:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Gemini API Endpoints
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

app.post("/api/gemini/summary", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini API Key is not configured on the server." });
  }
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: "Missing data" });

  const productList = data.products?.map((p: any) => `- ${p.nexstarModel} (${p.qtyInContainer} units)`).join('\n') || '';
  const prompt = `
      Generate a concise, professional executive summary for a business plan for a consolidated container based on the following data. The plan is named "${data.planName}".
      Assume the role of a financial analyst presenting to potential investors. Go beyond the surface-level data to provide a brief analysis of what these numbers signify (e.g., strong profitability from a diversified product mix, efficient cost management, high-return potential).
      The summary should be optimistic but grounded in the provided data. It should be one paragraph.
      The tone should be confident, analytical, and persuasive.

      Key Aggregated Data:
      - Total Investment (for one container): $${data.totalInvestment?.toFixed(2) || '0.00'}
      - Projected Total Sales (for one container): $${data.totalSales?.toFixed(2) || '0.00'}
      - Projected Net Profit (for one container): $${data.netProfit?.toFixed(2) || '0.00'}
      - Net Sales Margin: ${data.netSalesMarginPercent?.toFixed(2) || '0.00'}%
      - Gross Markup: ${data.grossMarkupPercent?.toFixed(2) || '0.00'}%
      - Destination Market: ${data.destination || 'N/A'}

      Products in Container:
      ${productList}

      Weave the key data into a compelling narrative about this consolidated shipment as a business opportunity. Do not just list the numbers.
  `;

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
      res.json({ summary: response.text });
  } catch (error: any) {
      console.error("[Gemini Error] Error generating summary:", error);
      res.status(500).json({ error: error.message || String(error) });
  }
});

app.post("/api/gemini/translate", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini API Key is not configured on the server." });
  }
  const { textToTranslate } = req.body;
  if (!textToTranslate) return res.status(400).json({ error: "Missing textToTranslate" });

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
          config: {
              safetySettings: [
                  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              ]
          }
      });
      res.json({ translatedText: response.text });
  } catch (error: any) {
      console.error("[Gemini Error] Error translating text:", error);
      res.status(500).json({ error: error.message || String(error) });
  }
});

export default app;
