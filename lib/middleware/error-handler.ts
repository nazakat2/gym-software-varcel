import { Request, Response, NextFunction } from "express";
import { ZodError, ZodSchema } from "zod/v4";

/**
 * Standard API Response Format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  message?: string;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Success Response Helper
 */
export function successResponse<T>(
  data: T,
  message?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Error Response Helper
 */
export function errorResponse(
  error: string,
  errors?: Record<string, string[]>
): ApiResponse {
  return {
    success: false,
    error,
    errors,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Validation Middleware Factory
 * Validates request body, query, or params against a Zod schema
 */
export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const validated = schema.parse(data);

      // Replace request data with validated data
      req[source] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};

        error.errors.forEach((err) => {
          const path = err.path.join(".");
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(err.message);
        });

        res.status(400).json(
          errorResponse("Validation failed", errors)
        );
      } else {
        res.status(400).json(
          errorResponse("Invalid request data")
        );
      }
    }
  };
}

/**
 * Global Error Handler Middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error("Error:", err);

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};

    err.errors.forEach((error) => {
      const path = error.path.join(".");
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(error.message);
    });

    res.status(400).json(
      errorResponse("Validation failed", errors)
    );
    return;
  }

  // Database errors
  if (err.name === "PostgresError") {
    // Unique constraint violation
    if ((err as any).code === "23505") {
      res.status(409).json(
        errorResponse("Record already exists")
      );
      return;
    }

    // Foreign key violation
    if ((err as any).code === "23503") {
      res.status(400).json(
        errorResponse("Referenced record does not exist")
      );
      return;
    }
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    res.status(401).json(
      errorResponse("Invalid authentication token")
    );
    return;
  }

  if (err.name === "TokenExpiredError") {
    res.status(401).json(
      errorResponse("Authentication token expired")
    );
    return;
  }

  // Default error
  const statusCode = (err as any).statusCode || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message;

  res.status(statusCode).json(errorResponse(message));
}

/**
 * Not Found Handler
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json(
    errorResponse(`Route not found: ${req.method} ${req.path}`)
  );
}

/**
 * Async Handler Wrapper
 * Catches async errors and passes them to error handler
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Custom Error Classes
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "Validation failed") {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, 409);
  }
}

/**
 * Example Usage:
 *
 * // Validation
 * const createMemberSchema = z.object({
 *   name: z.string().min(1),
 *   phone: z.string().min(10),
 *   email: z.string().email().optional(),
 * });
 *
 * app.post(
 *   "/api/members",
 *   validate(createMemberSchema),
 *   asyncHandler(async (req, res) => {
 *     const member = await createMember(req.body);
 *     res.json(successResponse(member, "Member created successfully"));
 *   })
 * );
 *
 * // Error handling
 * app.get("/api/members/:id", asyncHandler(async (req, res) => {
 *   const member = await getMember(req.params.id);
 *   if (!member) {
 *     throw new NotFoundError("Member not found");
 *   }
 *   res.json(successResponse(member));
 * }));
 *
 * // Apply error handlers (at the end of middleware chain)
 * app.use(notFoundHandler);
 * app.use(errorHandler);
 */
