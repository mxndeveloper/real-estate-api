// server/routes/ad.js
import express from "express";
import {
  uploadSingleImage,
  uploadMultipleImages,
  removeMultipleImages,
  removeSingleImage,
  createAd,
  read,
  adsForSell,
  adsForRent
} from "../controllers/ad.js";
import { uploadSingle, uploadMultiple } from "../middlewares/upload.js";
import { requireSignin } from "../middlewares/auth.js";
import ad from "../models/ad.js";


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

router.post("/create-ad", requireSignin, createAd);
router.get("/ad/:slug", read);
router.get("/ads-for-sell/:page", adsForSell);  // 1, 2, 3
router.get("/ads-for-rent/:page", adsForRent);

export default router;

