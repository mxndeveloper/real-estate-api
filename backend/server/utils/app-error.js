/**
 * Custom Error Class for Application Errors
 * @module utils/app-error
 * @extends Error
 */
class AppError extends Error {
  /**
   * Create a custom application error
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} [status='fail'] - Status type (fail for client errors, error for server errors)
   * @param {boolean} [isOperational=true] - Indicates if error is operational (trusted)
   */
  constructor(message, statusCode, status = undefined, isOperational = true) {
    super(message);

    // Set error properties
    this.statusCode = statusCode;
    this.status = status || `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    // Capture stack trace (excluding constructor call)
    Error.captureStackTrace(this, this.constructor);

    // Log error creation in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[AppError] ${this.statusCode} ${this.message}`);
    }
  }

  /**
   * Create a bad request error (400)
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static badRequest(message = 'Invalid request') {
    return new AppError(message, 400);
  }

  /**
   * Create an unauthorized error (401)
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static unauthorized(message = 'Not authorized') {
    return new AppError(message, 401);
  }

  /**
   * Create a forbidden error (403)
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403);
  }

  /**
   * Create a not found error (404)
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static notFound(message = 'Resource not found') {
    return new AppError(message, 404);
  }

  /**
   * Create a conflict error (409)
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static conflict(message = 'Resource conflict') {
    return new AppError(message, 409);
  }

  /**
   * Create a validation error (422)
   * @param {string} message - Error message
   * @param {object} [errors] - Validation errors
   * @returns {AppError}
   */
  static validation(message = 'Validation failed', errors = {}) {
    const error = new AppError(message, 422);
    error.errors = errors;
    return error;
  }

  /**
   * Create an internal server error (500)
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static internal(message = 'Internal server error') {
    return new AppError(message, 500);
  }

  /**
   * Convert error to JSON response format
   * @returns {object} - Error response object
   */
  toJSON() {
    return {
      status: this.status,
      statusCode: this.statusCode,
      message: this.message,
      ...(this.errors && { errors: this.errors }),
      ...(process.env.NODE_ENV === 'development' && {
        stack: this.stack,
        timestamp: this.timestamp
      })
    };
  }
}

export default AppError;