// backend/server/middlewares/validate.js
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';

export const validateContactRequest = [
  // Validate adId
  body('adId')
    .notEmpty()
    .withMessage('Ad ID is required')
    .isMongoId()
    .withMessage('Invalid Ad ID format'),
    
  // Validate message
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isString()
    .withMessage('Message must be a string')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Message must be between 10 and 1000 characters'),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array().map(err => ({
          param: err.param,
          message: err.msg
        }))
      });
    }
    next();
  }
];

// Middleware implementation
export const validateAdId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.adId)) {
    return res.status(400).json({
      success: false,
      error: "Invalid Ad ID format"
    });
  }
  next();
};