class ValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.statusCode = 400;
  }
}

class ProcessingError extends Error {
  constructor(message, code = 'PROCESSING_ERROR') {
    super(message);
    this.name = 'ProcessingError';
    this.code = code;
    this.statusCode = 500;
  }
}

class DatabaseError extends Error {
  constructor(message, code = 'DATABASE_ERROR') {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.statusCode = 500;
  }
}

module.exports = {
  ValidationError,
  ProcessingError,
  DatabaseError
};