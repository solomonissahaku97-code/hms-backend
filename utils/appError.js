class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.details = details; // Additional error details
    this.timestamp = new Date().toISOString();

    // Only capture stack trace in development
    if (process.env.NODE_ENV === 'development') {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Static constructor methods for common errors
  static badRequest(message, details) {
    return new AppError(message, 400, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 404);
  }

  static conflict(message = 'Conflict occurred') {
    return new AppError(message, 409);
  }

  static internalError(message = 'Internal server error') {
    return new AppError(message, 500);
  }
}

module.exports = AppError;