/**
 * COMPREHENSIVE ERROR HANDLING UTILITIES
 * 
 * Provides:
 * - Typed error classes for different error types
 * - Error logging with context
 * - User-friendly error messages
 * - API error response helpers
 * - React error boundary helpers
 */

// ============================================
// Error Types
// ============================================

export enum ErrorCode {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  AUTH_RATE_LIMITED = 'AUTH_RATE_LIMITED',
  
  // Balance errors
  BALANCE_INSUFFICIENT = 'BALANCE_INSUFFICIENT',
  BALANCE_UPDATE_FAILED = 'BALANCE_UPDATE_FAILED',
  BALANCE_SYNC_FAILED = 'BALANCE_SYNC_FAILED',
  
  // Trade errors
  TRADE_INVALID_AMOUNT = 'TRADE_INVALID_AMOUNT',
  TRADE_INVALID_DIRECTION = 'TRADE_INVALID_DIRECTION',
  TRADE_MARKET_CLOSED = 'TRADE_MARKET_CLOSED',
  TRADE_DUPLICATE = 'TRADE_DUPLICATE',
  TRADE_NOT_FOUND = 'TRADE_NOT_FOUND',
  TRADE_ALREADY_CLOSED = 'TRADE_ALREADY_CLOSED',
  
  // Deposit/Withdrawal errors
  DEPOSIT_FAILED = 'DEPOSIT_FAILED',
  WITHDRAWAL_INSUFFICIENT_FUNDS = 'WITHDRAWAL_INSUFFICIENT_FUNDS',
  WITHDRAWAL_KYC_REQUIRED = 'WITHDRAWAL_KYC_REQUIRED',
  WITHDRAWAL_LIMIT_EXCEEDED = 'WITHDRAWAL_LIMIT_EXCEEDED',
  
  // KYC errors
  KYC_DOCUMENT_INVALID = 'KYC_DOCUMENT_INVALID',
  KYC_ALREADY_SUBMITTED = 'KYC_ALREADY_SUBMITTED',
  
  // Database errors
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',
  DB_RECORD_NOT_FOUND = 'DB_RECORD_NOT_FOUND',
  
  // Validation errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  VALIDATION_MISSING_FIELD = 'VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',
  
  // Network errors
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  
  // Generic errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// User-friendly error messages
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password. Please try again.',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.AUTH_UNAUTHORIZED]: 'You don\'t have permission to perform this action.',
  [ErrorCode.AUTH_RATE_LIMITED]: 'Too many attempts. Please wait a few minutes and try again.',
  
  [ErrorCode.BALANCE_INSUFFICIENT]: 'Insufficient balance to complete this transaction.',
  [ErrorCode.BALANCE_UPDATE_FAILED]: 'Failed to update your balance. Please try again.',
  [ErrorCode.BALANCE_SYNC_FAILED]: 'Failed to sync your balance. Please refresh the page.',
  
  [ErrorCode.TRADE_INVALID_AMOUNT]: 'Please enter a valid trade amount.',
  [ErrorCode.TRADE_INVALID_DIRECTION]: 'Invalid trade direction. Please select UP or DOWN.',
  [ErrorCode.TRADE_MARKET_CLOSED]: 'The market is currently closed. Please try again during trading hours.',
  [ErrorCode.TRADE_DUPLICATE]: 'This trade has already been placed.',
  [ErrorCode.TRADE_NOT_FOUND]: 'Trade not found.',
  [ErrorCode.TRADE_ALREADY_CLOSED]: 'This trade has already been closed.',
  
  [ErrorCode.DEPOSIT_FAILED]: 'Deposit failed. Please try again or contact support.',
  [ErrorCode.WITHDRAWAL_INSUFFICIENT_FUNDS]: 'You don\'t have enough funds to withdraw this amount.',
  [ErrorCode.WITHDRAWAL_KYC_REQUIRED]: 'Please complete identity verification before withdrawing.',
  [ErrorCode.WITHDRAWAL_LIMIT_EXCEEDED]: 'This withdrawal exceeds your daily limit.',
  
  [ErrorCode.KYC_DOCUMENT_INVALID]: 'The uploaded document is invalid. Please try a different file.',
  [ErrorCode.KYC_ALREADY_SUBMITTED]: 'Your documents have already been submitted for review.',
  
  [ErrorCode.DB_CONNECTION_FAILED]: 'Unable to connect to the server. Please try again.',
  [ErrorCode.DB_QUERY_FAILED]: 'Something went wrong. Please try again.',
  [ErrorCode.DB_RECORD_NOT_FOUND]: 'The requested item was not found.',
  
  [ErrorCode.VALIDATION_FAILED]: 'Please check your input and try again.',
  [ErrorCode.VALIDATION_MISSING_FIELD]: 'Please fill in all required fields.',
  [ErrorCode.VALIDATION_INVALID_FORMAT]: 'Please check the format of your input.',
  
  [ErrorCode.NETWORK_TIMEOUT]: 'The request timed out. Please check your connection.',
  [ErrorCode.NETWORK_UNAVAILABLE]: 'Network unavailable. Please check your internet connection.',
  
  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCode.UNKNOWN_ERROR]: 'Something went wrong. Please try again or contact support.',
};

// ============================================
// Custom Error Classes
// ============================================

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message?: string,
    statusCode: number = 500,
    details?: Record<string, any>
  ) {
    super(message || ERROR_MESSAGES[code] || 'An error occurred');
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// Specific error classes for better type checking
export class AuthError extends AppError {
  constructor(code: ErrorCode, message?: string, details?: Record<string, any>) {
    super(code, message, code === ErrorCode.AUTH_RATE_LIMITED ? 429 : 401, details);
  }
}

export class ValidationError extends AppError {
  constructor(message?: string, details?: Record<string, any>) {
    super(ErrorCode.VALIDATION_FAILED, message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(ErrorCode.DB_RECORD_NOT_FOUND, `${resource} not found`, 404);
  }
}

export class InsufficientFundsError extends AppError {
  constructor(required: number, available: number) {
    super(
      ErrorCode.BALANCE_INSUFFICIENT,
      `Insufficient balance. Required: $${required.toFixed(2)}, Available: $${available.toFixed(2)}`,
      400,
      { required, available }
    );
  }
}

// ============================================
// Error Logging
// ============================================

interface ErrorLogContext {
  userId?: string;
  action?: string;
  endpoint?: string;
  requestId?: string;
  [key: string]: any;
}

export function logError(error: Error | AppError, context?: ErrorLogContext): void {
  const timestamp = new Date().toISOString();
  const isAppError = error instanceof AppError;
  
  const logEntry = {
    timestamp,
    type: isAppError ? 'AppError' : 'Error',
    code: isAppError ? (error as AppError).code : 'UNKNOWN',
    message: error.message,
    stack: error.stack,
    context,
    isOperational: isAppError ? (error as AppError).isOperational : false,
  };
  
  // In production, you'd send this to a logging service like Sentry, LogRocket, etc.
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to logging service
    console.error('[ERROR]', JSON.stringify(logEntry));
  } else {
    console.error('[ERROR]', logEntry);
  }
}

// ============================================
// API Response Helpers
// ============================================

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

export function createErrorResponse(error: Error | AppError): ApiErrorResponse {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }
  
  // Don't expose internal error details in production
  const message = process.env.NODE_ENV === 'production'
    ? ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR]
    : error.message;
  
  return {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message,
    },
  };
}

export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
  };
}

// ============================================
// Error Handler Wrapper for API Routes
// ============================================

type AsyncHandler = (request: Request) => Promise<Response>;

export function withErrorHandler(handler: AsyncHandler): AsyncHandler {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error: any) {
      logError(error, {
        endpoint: request.url,
        method: request.method,
      });
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      const response = createErrorResponse(error);
      
      return new Response(JSON.stringify(response), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

// ============================================
// React Helpers
// ============================================

/**
 * Get user-friendly error message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return ERROR_MESSAGES[ErrorCode.NETWORK_UNAVAILABLE];
    }
    if (error.message.includes('timeout')) {
      return ERROR_MESSAGES[ErrorCode.NETWORK_TIMEOUT];
    }
    
    // Don't expose raw error messages in production
    return process.env.NODE_ENV === 'production'
      ? ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR]
      : error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
}

/**
 * Parse API error response
 */
export function parseApiError(response: ApiErrorResponse): { code: string; message: string } {
  return {
    code: response.error.code,
    message: response.error.message,
  };
}

// ============================================
// Validation Helpers
// ============================================

export function validateRequired(fields: Record<string, any>, requiredFields: string[]): ValidationError | null {
  const missingFields = requiredFields.filter(field => {
    const value = fields[field];
    return value === undefined || value === null || value === '';
  });
  
  if (missingFields.length > 0) {
    return new ValidationError(
      `Missing required fields: ${missingFields.join(', ')}`,
      { missingFields }
    );
  }
  
  return null;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateAmount(amount: number, min: number = 0, max?: number): ValidationError | null {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return new ValidationError('Amount must be a valid number');
  }
  
  if (amount < min) {
    return new ValidationError(`Amount must be at least ${min}`);
  }
  
  if (max !== undefined && amount > max) {
    return new ValidationError(`Amount cannot exceed ${max}`);
  }
  
  return null;
}
