import { jest } from "@jest/globals";

// Mock jsonwebtoken and env config before importing auth middleware
jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    verify: jest.fn(),
  },
}));

jest.unstable_mockModule("../../../src/config/env.js", () => ({
  getJwtSecret: jest.fn(() => "testsecret"),
}));

// Dynamically import the mocked modules and the module under test
const jwt = (await import("jsonwebtoken")).default;
const { authenticateToken, requireRole } = await import("../../../src/middleware/auth.js");

describe("Auth Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("authenticateToken", () => {
    test("returns 401 if no authorization header is provided", () => {
      authenticateToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "No token provided" });
      expect(next).not.toHaveBeenCalled();
    });

    test("attaches decoded payload to req.user and calls next() on valid token", () => {
      req.headers.authorization = "Bearer validtoken";
      const mockUser = { id: 1, role: "patient" };
      jwt.verify.mockReturnValue(mockUser);

      authenticateToken(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith("validtoken", "testsecret");
      expect(req.user).toBe(mockUser);
      expect(next).toHaveBeenCalled();
    });

    test("returns 403 if token validation throws an error", () => {
      req.headers.authorization = "Bearer invalidtoken";
      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid or expired token" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("requireRole", () => {
    test("returns 401 if req.user is missing", () => {
      const middleware = requireRole("doctor");
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 403 if req.user has a different role", () => {
      req.user = { id: 1, role: "patient" };
      const middleware = requireRole("doctor");
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Access denied. doctor role required." });
      expect(next).not.toHaveBeenCalled();
    });

    test("calls next() if req.user has the correct role", () => {
      req.user = { id: 1, role: "doctor" };
      const middleware = requireRole("doctor");
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
