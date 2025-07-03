// server/middlewares/uploads.js
import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (validTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG/PNG/WEBP allowed'), false);
  }
};

// Single file upload middleware
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('image'); // Field name for single upload

// Multiple files upload middleware
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5 // Max 5 files
  }
}).array('images', 5); // Field name and max count for multiple uploads