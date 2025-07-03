// server/utils/multer-config.js
import multer from "multer";
import path from "path";

// Supported image types
const VALID_MIME_TYPES=['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE= 10 * 1024 * 1024; // 10MB

const fileFilter = (req, file, cb) => {
  if (VALID_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${VALID_MIME_TYPES.join(', ')} allowed`), false);
  }
};

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE, // 10MB
    files: 1 // For single uploads
  }
});

// Named exports for different use cases
export const uploadSingleImage = upload.single('image'); 
export const uploadMultipleImages = upload.array('images', 5); // Example for future use
export const mixedUpload = upload.fields([ // Example for future use
  { name: 'avatar', maxCount: 1 },
  { name: 'gallery', maxCount: 5 }
]);