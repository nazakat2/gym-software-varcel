import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Gym Management API",
      version: "1.0.0",
      description: "Complete API documentation for the Gym Management System",
      contact: {
        name: "API Support",
        email: "support@gymmanagement.com",
      },
    },
    servers: [
      {
        url: "http://localhost:5000/api",
        description: "Development server",
      },
      {
        url: "https://api.gymmanagement.com/api",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        adminEmail: {
          type: "apiKey",
          in: "header",
          name: "x-admin-email",
        },
      },
      schemas: {
        Member: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            phone: { type: "string" },
            email: { type: "string", nullable: true },
            gender: { type: "string", enum: ["male", "female"] },
            plan: { type: "string", enum: ["monthly", "quarterly", "yearly"] },
            planStartDate: { type: "string", format: "date" },
            planExpiryDate: { type: "string", format: "date" },
            status: { type: "string", enum: ["active", "expired", "frozen"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Employee: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            role: { type: "string", enum: ["trainer", "receptionist", "manager"] },
            phone: { type: "string" },
            email: { type: "string", nullable: true },
            salary: { type: "string" },
            status: { type: "string", enum: ["active", "inactive"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Attendance: {
          type: "object",
          properties: {
            id: { type: "integer" },
            memberId: { type: "integer" },
            date: { type: "string", format: "date" },
            checkInTime: { type: "string" },
            checkOutTime: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Measurement: {
          type: "object",
          properties: {
            id: { type: "integer" },
            memberId: { type: "integer" },
            weight: { type: "number" },
            height: { type: "number" },
            bmi: { type: "number" },
            bodyFat: { type: "number", nullable: true },
            date: { type: "string", format: "date" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            message: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
    tags: [
      { name: "Health", description: "Health check endpoints" },
      { name: "Admin Auth", description: "Admin authentication endpoints" },
      { name: "Member Auth", description: "Member authentication endpoints" },
      { name: "Dashboard", description: "Admin dashboard statistics" },
      { name: "Members", description: "Member management endpoints" },
      { name: "Employees", description: "Employee management endpoints" },
      { name: "Attendance", description: "Attendance tracking endpoints" },
      { name: "Measurements", description: "Body measurement tracking" },
      { name: "Billing", description: "Invoice and payment management" },
      { name: "Inventory", description: "Product and supplier management" },
      { name: "Classes", description: "Gym class scheduling and booking" },
      { name: "Chatbot", description: "AI chatbot endpoints" },
    ],
  },
  apis: ["./src/routes/*.ts"], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);
