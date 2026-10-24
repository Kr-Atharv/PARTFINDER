import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { SignJWT } from "jose";
import { config } from "../src/config";

describe("Health API", () => {
  it("GET /api/health should return 200 with status ok and uptime", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("uptime");
    expect(typeof res.body.uptime).toBe("number");
  });
});

describe("Auth Middleware & Protected Routes", () => {
  it("GET /api/protected/dashboard without token should return 401 Missing auth token", async () => {
    const res = await request(app).get("/api/protected/dashboard");
    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty("code", "AUTH_MISSING_TOKEN");
  });

  it("GET /api/protected/dashboard with invalid token should return 401 AUTH_INVALID_TOKEN", async () => {
    const res = await request(app)
      .get("/api/protected/dashboard")
      .set("Cookie", [`${config.SESSION_COOKIE_NAME}=invalid.token.here`]);
    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty("code", "AUTH_INVALID_TOKEN");
  });

  it("GET /api/protected/dashboard with valid signed JWT should return 200 and user data", async () => {
    const secret = new TextEncoder().encode(config.SUPABASE_JWT_SECRET || "test-jwt-secret-minimum-32-characters-long!!");
    const validToken = await new SignJWT({
      sub: "user-12345",
      email: "engineer@partfinder.io",
      role: "authenticated",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(secret);

    const res = await request(app)
      .get("/api/protected/dashboard")
      .set("Cookie", [`${config.SESSION_COOKIE_NAME}=${validToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("message");
    expect(res.body.data.user).toHaveProperty("sub", "user-12345");
    expect(res.body.data.user).toHaveProperty("email", "engineer@partfinder.io");
  });

  it("GET /api/protected/dashboard with expired JWT should return 401 AUTH_INVALID_TOKEN", async () => {
    const secret = new TextEncoder().encode(config.SUPABASE_JWT_SECRET || "test-jwt-secret-minimum-32-characters-long!!");
    const expiredToken = await new SignJWT({
      sub: "user-expired",
      email: "expired@partfinder.io",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // expired 1 hour ago
      .sign(secret);

    const res = await request(app)
      .get("/api/protected/dashboard")
      .set("Cookie", [`${config.SESSION_COOKIE_NAME}=${expiredToken}`]);

    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty("code", "AUTH_INVALID_TOKEN");
  });
});

describe("Auth Validation", () => {
  it("POST /api/auth/signup with invalid email and short password should return 400 VALIDATION_ERROR", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "not-an-email",
      password: "123",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });
});
