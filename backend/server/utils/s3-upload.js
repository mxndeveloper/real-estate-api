// server/utils/s3-uploads.js
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate unique S3 key for upload
 * @param {Object} file - Uploaded file
 * @param {string} userId - User ID
 * @returns {string} - S3 object key
 */
const generateS3Key = (file, userId) => {
  const timestamp = Date.now();
  const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = path.extname(sanitizedFilename).toLowerCase() || '.jpg';
  return `uploads/${userId}/${timestamp}_${path.parse(sanitizedFilename).name}${ext}`;
};

/**
 * Upload files to S3 with proper metadata
 * @param {Array} files - Array of files to upload
 * @param {string} userId - User ID for path
 * @returns {Promise<Array>} - Array of upload results
 */
export const uploadToS3 = async (files, userId) => {
  if (!files || !Array.isArray(files)) {
    throw new Error("Files array is required");
  }

  try {
    const uploadPromises = files.map(async (file) => {
      const key = generateS3Key(file, userId);

      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: encodeURIComponent(file.originalname),
          uploadedBy: userId,
          processed: 'true',
        },
      };

      await s3Client.send(new PutObjectCommand(params));

      return {
        Location: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
        Key: key,
      };
    });

    return await Promise.all(uploadPromises);
  } catch (err) {
    console.error("S3 Upload Error:", err);
    throw new AppError(`Failed to upload to S3: ${err.message}`, 500);
  }
};

/**
 * Delete file from S3 with existence check
 * @param {string} key - S3 object key
 * @returns {Promise<void>}
 */
export const deleteFromS3 = async (key) => {
  try {
    // Verify object exists first
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key,
        })
      );
    } catch (err) {
      if (err.name === 'NotFound') {
        throw new AppError('File not found', 404);
      }
      throw err;
    }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      })
    );
  } catch (err) {
    console.error(`Failed to delete ${key}:`, err);
    err.key = key; // Attach key to error for identification
    throw err;
  }
};