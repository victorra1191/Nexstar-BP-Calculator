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

export default app;
