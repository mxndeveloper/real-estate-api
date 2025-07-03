// server/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import adRoutes from "./routes/ad.js";

const app = express();

// 1. Essential middleware (ORDER MATTERS!)
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. DB Connection
mongoose.connect(process.env.DATABASE)
  .then(() => {
    console.log("DB Connected");
    
    // 3. Routes
    app.use("/api", authRoutes);
    app.use("/api", adRoutes);
    
    // 4. Error handling
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ error: err.message });
    });
  })
  .catch(err => console.log("DB Error:", err));

app.listen(8000, () => console.log("Server running on port 8000"));