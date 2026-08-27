/**
 * Global error handler for the Lab Service.
 */

const errorHandler = (err, req, res, next) => {
  console.error('❌ Lab Service Error:', err.message);

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      details: err.errors.map((e) => e.message),
    });
  }

  // Sequelize unique constraint error
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      status: 'error',
      message: 'Resource already exists',
      details: err.errors.map((e) => e.message),
    });
  }

  // Custom AppError
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // Default
  res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
};

module.exports = errorHandler;
