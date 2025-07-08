// server/index.js
import "dotenv/config";
import express from "express";
import axios from "axios";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import adRoutes from "./routes/ad.js";

const app = express();

// 1. Middleware
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));

// 2. DB Connection
mongoose.connect(process.env.DATABASE)
  .then(() => {
    console.log("DB Connected");

    // 3. Places API Endpoint (Updated)
    app.get("/api/maps/nearby", async (req, res) => {
      try {
        const { latitude, longitude, radius = 1500, type = "restaurant" } = req.query;

        // Validate parameters
        if (!latitude || !longitude) {
          return res.status(400).json({ error: "Missing latitude/longitude" });
        }

        const response = await axios.post(
          "https://places.googleapis.com/v1/places:searchNearby",
          {
            includedTypes: [type],
            maxResultCount: 10,
            locationRestriction: {
              circle: {
                center: {
                  latitude: parseFloat(latitude),
                  longitude: parseFloat(longitude),
                },
                radius: parseFloat(radius),
              },
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
              "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.types",
            },
          }
        );

        res.json(response.data);
      } catch (error) {
        console.error("Google API Error:", {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        res.status(500).json({
          error: "Google API request failed",
          details: error.response?.data || error.message,
        });
      }
    });

    // Other routes...
    app.use("/api", authRoutes);
    app.use("/api", adRoutes);

    // Error handling
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ error: err.message });
    });
  })
  .catch(err => console.log("DB Error:", err));

app.listen(8000, () => console.log("Server running on port 8000"));