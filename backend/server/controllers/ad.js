// server/controllers/ad.js
import { uploadToS3, deleteFromS3 } from "../utils/s3-upload.js";
import sharp from "sharp";
import AppError from "../utils/app-error.js";

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
          deletedAt: new Date().toISOString()
        }
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
          deletedAt: new Date().toISOString()
        }
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
