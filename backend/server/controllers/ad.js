// server/controllers/ad.js
import { nanoid } from "nanoid"; // Add this import at the top
import { uploadToS3, deleteFromS3 } from "../utils/s3-upload.js";
import sharp from "sharp";
import AppError from "../utils/app-error.js";
import { geocodeAddress } from "../helpers/google.js";
import Ad from "../models/ad.js";
import User from "../models/user.js";
import user from "../models/user.js";
import slugify from "slugify";

// Image optimization profiles
const OPTIMIZATION_PROFILES = {
  thumbnail: {
    quality: 70,
    width: 400,
    height: 400,
    fit: "cover",
    format: "jpeg",
  },
  standard: {
    quality: 80,
    width: 1200,
    height: 800,
    fit: "inside",
    format: "jpeg",
  },
  highQuality: {
    quality: 90,
    width: 1920,
    height: 1080,
    fit: "inside",
    format: "jpeg",
  },
  webp: {
    quality: 80,
    width: 1200,
    height: 800,
    fit: "inside",
    format: "webp",
  },
};

/**
 * Process image buffer with sharp
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Sharp processing options
 * @returns {Promise<Buffer>} - Optimized image buffer
 */
const processImage = async (
  buffer,
  options = OPTIMIZATION_PROFILES.standard
) => {
  try {
    let sharpInstance = sharp(buffer).resize(options.width, options.height, {
      fit: options.fit,
      withoutEnlargement: true,
    });

    if (options.format === "webp") {
      sharpInstance = sharpInstance.webp({ quality: options.quality });
    } else {
      sharpInstance = sharpInstance.jpeg({
        quality: options.quality,
        mozjpeg: true,
      });
    }

    return await sharpInstance.toBuffer();
  } catch (err) {
    throw new AppError(`Image processing failed: ${err.message}`, 400);
  }
};

/**
 * Validate and get optimization profile
 * @param {string} profileName - Requested profile name
 * @returns {Object} - Optimization profile
 */
const getOptimizationProfile = (profileName) => {
  if (!profileName || !OPTIMIZATION_PROFILES[profileName]) {
    return OPTIMIZATION_PROFILES.standard;
  }
  return OPTIMIZATION_PROFILES[profileName];
};

/**
 * Generate file metadata for response
 * @param {Object} file - Original file
 * @param {Buffer} processedBuffer - Processed image buffer
 * @param {Object} optimization - Optimization profile used
 * @param {Object} s3Result - S3 upload result
 * @returns {Object} - Formatted metadata
 */
const generateFileMetadata = (
  file,
  processedBuffer,
  optimization,
  s3Result
) => ({
  url: s3Result.Location,
  key: s3Result.Key,
  size: {
    original: file.size,
    optimized: processedBuffer.length,
    reduction: Math.round((1 - processedBuffer.length / file.size) * 100),
    unit: "%",
  },
  format: optimization.format,
  dimensions: {
    width: optimization.width,
    height: optimization.height,
  },
  lastModified: new Date().toISOString(),
});

/**
 * Upload single optimized image to S3
 */
export const uploadSingleImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded. Use field name "image"', 400);
    }

    // Validate and get optimization profile
    const optimization = getOptimizationProfile(req.query.profile);

    // Process image
    const processedBuffer = await processImage(req.file.buffer, optimization);
    const processedFile = {
      ...req.file,
      buffer: processedBuffer,
      mimetype: `image/${optimization.format}`,
    };

    // Upload to S3
    const [result] = await uploadToS3([processedFile], req.user._id);

    res.status(200).json({
      status: "success",
      data: generateFileMetadata(
        req.file,
        processedBuffer,
        optimization,
        result
      ),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Upload multiple optimized images to S3
 */
export const uploadMultipleImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new AppError('No files uploaded. Use field name "images"', 400);
    }

    // Validate and get optimization profile
    const optimization = getOptimizationProfile(req.query.profile);

    // Process all images in parallel with error handling
    const processingResults = await Promise.all(
      req.files.map(async (file) => {
        try {
          const processedBuffer = await processImage(file.buffer, optimization);
          return {
            originalFile: file,
            processedFile: {
              ...file,
              buffer: processedBuffer,
              mimetype: `image/${optimization.format}`,
            },
            optimization,
          };
        } catch (err) {
          console.error(`Failed to process ${file.originalname}:`, err);
          return { error: true, file, message: err.message };
        }
      })
    );

    // Separate successful and failed processing
    const failedProcessing = processingResults.filter((r) => r.error);
    const successfulProcessing = processingResults.filter((r) => !r.error);

    if (failedProcessing.length > 0 && successfulProcessing.length === 0) {
      throw new AppError("All files failed processing", 400);
    }

    // Upload successful files to S3
    const uploadResults = await uploadToS3(
      successfulProcessing.map((r) => r.processedFile),
      req.user._id
    );

    // Prepare response
    const response = {
      status:
        successfulProcessing.length === req.files.length
          ? "success"
          : "partial",
      data: {
        successful: uploadResults.map((result, i) =>
          generateFileMetadata(
            successfulProcessing[i].originalFile,
            successfulProcessing[i].processedFile.buffer,
            successfulProcessing[i].optimization,
            result
          )
        ),
        failed: failedProcessing.map((f) => ({
          filename: f.file.originalname,
          error: f.message,
        })),
      },
    };

    res
      .status(successfulProcessing.length === req.files.length ? 200 : 207)
      .json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Validate image key ownership
 * @param {string} key - S3 object key
 * @param {string} userId - Current user ID
 * @throws {AppError} - If validation fails
 */
const validateKeyOwnership = (key, userId) => {
  if (!key) {
    throw new AppError("Image key is required", 400);
  }

  if (!key.startsWith(`uploads/${userId}/`)) {
    throw new AppError("Unauthorized to access this resource", 403);
  }
};

/**
 * Delete single image from S3
 */
export const removeSingleImage = async (req, res, next) => {
  try {
    // Check if body exists and has key property
    if (!req.body || !req.body.key) {
      throw new AppError("Image key is required in request body", 400);
    }

    const { key } = req.body;

    validateKeyOwnership(key, req.user._id);
    await deleteFromS3(key);

    res.status(200).json({
      status: "success",
      message: "Image successfully deleted",
      data: {
        key,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Remove single image error:", err);
    next(
      err instanceof AppError
        ? err
        : new AppError(`Failed to delete image: ${err.message}`, 500)
    );
  }
};

/**
 * Delete multiple images from S3
 */
export const removeMultipleImages = async (req, res, next) => {
  try {
    // Check if body exists and has keys property
    if (!req.body || !req.body.keys) {
      throw new AppError("Image keys array is required in request body", 400);
    }

    const { keys } = req.body;

    if (!Array.isArray(keys)) {
      throw new AppError("Keys must be provided as an array", 400);
    }

    if (keys.length === 0) {
      throw new AppError("At least one image key is required", 400);
    }

    // Validate all keys first
    keys.forEach((key) => validateKeyOwnership(key, req.user._id));

    const deleteResults = await Promise.allSettled(
      keys.map((key) => deleteFromS3(key))
    );

    const successfulDeletes = deleteResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    const failedDeletes = deleteResults
      .filter((result) => result.status === "rejected")
      .map((result) => ({
        key: result.reason.key || "unknown",
        error: result.reason.message,
      }));

    if (failedDeletes.length === 0) {
      return res.status(200).json({
        status: "success",
        message: "All images were successfully deleted",
        data: {
          deletedCount: successfulDeletes.length,
          deletedAt: new Date().toISOString(),
        },
      });
    }

    if (successfulDeletes.length > 0) {
      return res.status(207).json({
        status: "partial",
        message: "Some images were deleted successfully",
        data: {
          deletedCount: successfulDeletes.length,
          failedCount: failedDeletes.length,
          failedDeletes,
          deletedAt: new Date().toISOString(),
        },
      });
    }

    // If all failed
    throw new AppError("Failed to delete all images", 500);
  } catch (err) {
    console.error("Remove multiple images error:", err);
    next(
      err instanceof AppError
        ? err
        : new AppError(`Failed to delete images: ${err.message}`, 500)
    );
  }
};

export const createAd = async (req, res) => {
  try {
    const {
      photos = [], // Default empty array if not provided
      description,
      address,
      propertyType,
      price,
      landsize,
      landsizeType,
      action,
      bedrooms,
      bathrooms,
      carpark,
      features,
      inspectionTime,
    } = req.body;

    // Validate required fields
    const validateRequired = (field, name) => {
      if (!field || (typeof field === "string" && !field.trim())) {
        res.status(400).json({ error: `${name} is required` });
        return false;
      }
      return true;
    };

    // Check all required fields
    if (!validateRequired(photos?.length, "Photos")) return;
    if (!validateRequired(description, "Description")) return;
    if (!validateRequired(address, "Address")) return;
    if (!validateRequired(propertyType, "Property Type")) return;
    if (!validateRequired(price, "Price")) return;
    if (!validateRequired(action, "Action")) return;

    // Additional validation for Land type
    if (propertyType === "Land") {
      if (!validateRequired(landsize, "Landsize")) return;
      if (!validateRequired(landsizeType, "Landsize Type")) return;
    }

    // Geocode the address
    const geocodeResult = await geocodeAddress(address.trim());

    // Create slug first
    const slug = slugify(
      `${propertyType}-for-${action}-address-${address}-price-${price}-${nanoid(
        6
      )}`,
      {
        lower: true,
        remove: /[*+~.()'"!:@]/g, // Remove special characters
      }
    );

    // Create the ad
    const ad = await new Ad({
      ...req.body,
      slug, // Use the slug we just created
      photos: photos.map((photo) =>
        typeof photo === "string" ? photo : photo.url
      ), // Handle both strings and objects
      description,
      address,
      propertytype: propertyType, // Match schema field name
      price,
      landsize,
      landsizetype: landsizeType,
      bedrooms,
      bathrooms,
      carpark,
      features,
      inspectionTime,
      postedBy: req.user._id, // Use from auth middleware
      location: geocodeResult.location,
      googleMap: geocodeResult.googleMap,
      action,
      status: "In market",
    }).save();

    // Update user role (fixed typo in role name)
    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { role: "Seller" } },
      { new: true }
    );
    user.password = undefined;

    // Successful response
    res.json({
      success: true,
      ad: {
        _id: ad._id,
        photos: ad.photos,
        address: ad.address,
        price: ad.price,
        propertytype: ad.propertytype,
        location: ad.location,
        slug: ad.slug,
        // Include other fields you want to return
      },
    });
  } catch (err) {
    console.error("Create Ad Error:", err);

    // Handle specific error cases
    if (err.message.includes("No results found")) {
      return res.status(404).json({ error: "Address not found" });
    }
    if (err.message.includes("Google API Error")) {
      return res.status(502).json({ error: "Geocoding service unavailable" });
    }
    if (err.code === 11000) {
      // MongoDB duplicate key error
      return res.status(400).json({ error: "This property already exists" });
    }

    // Generic error response
    res.status(500).json({
      error: "Failed to create ad",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const read = async (req, res) => {
  try {
    const { slug } = req.params;

    const ad = await Ad.findOne({ slug })
      .select("-googleMap")
      .populate("postedBy", "name username email phone company photo logo");

    if (!ad) {
      return res.status(404).json({ error: "Ad not found" });
    }

    // First get basic related ads without population
    let related = await Ad.aggregate([
      {
        $geoNear: {
          near: ad.location,
          distanceField: "distance",
          maxDistance: 50000, // 50km in meters
          spherical: true,
          query: {
            _id: { $ne: ad._id },
            // Remove these strict filters to get more results
            action: ad.action,
            propertytype: ad.propertytype,
            published: true,
          },
        },
      },
      { $limit: 3 },
      { $project: { googleMap: 0 } },
    ]);

    // Then populate the postedBy field
    related = await Ad.populate(related, {
      path: "postedBy",
      select: "name username email phone company photo logo",
    });

    res.json({
      ad,
      related: related || [], // Ensure we always return an array
    });
  } catch (err) {
    console.error("Error in read controller:", err);
    res.status(500).json({ error: "Failed to fetch ad details" });
  }
};

export const adsForSell = async (req, res) => {
  try {
    // Correct way to get the page number from URL params
    const page = parseInt(req.params.pageNumber) || 1; // Assuming your route is '/ads-for-sell/:pageNumber'
    
    // Alternatively, if you're using query params (?page=1):
    // const page = parseInt(req.query.page) || 1;
    
    if (isNaN(page) || page < 1) {
      return res.status(400).json({ error: "Invalid page number" });
    }

    const pageSize = 2;
    const skip = (page - 1) * pageSize;
    const totalAds = await Ad.countDocuments({ action: "Sell" });

    const ads = await Ad.find({ action: "Sell" })
      .populate("postedBy", "name username email phone company photo logo")
      .select("-googleMap")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    res.json({
      ads,
      currentPage: page,
      totalPages: Math.ceil(totalAds / pageSize),
      totalAds
    });
  } catch (err) {
    console.error("Error in adsForSell:", err); // Better error logging
    res.status(500).json({
      error: "Failed to fetch ads. Please try again."
    });
  }
};
