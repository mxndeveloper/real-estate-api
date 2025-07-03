// server/routes/ad.js
import express from "express";
import {
  uploadSingleImage,
  uploadMultipleImages,
  removeMultipleImages,
  removeSingleImage,
} from "../controllers/ad.js";
import { uploadSingle, uploadMultiple } from "../middlewares/upload.js";
import { requireSignin } from "../middlewares/auth.js";

const router = express.Router();

// Single image upload route
router.post("/upload-image", requireSignin, uploadSingle, uploadSingleImage);

// Single image remove route
router.delete("/remove-image", requireSignin, removeSingleImage);

// Single image remove route
router.delete("/remove-images", requireSignin, removeMultipleImages);

// Multiple images upload route
router.post(
  "/upload-images",
  requireSignin,
  uploadMultiple,
  uploadMultipleImages
);

export default router;
