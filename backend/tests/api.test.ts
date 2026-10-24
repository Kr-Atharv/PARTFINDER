import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/app";
import { SignJWT } from "jose";
import { config } from "../src/config";
import { prisma } from "../src/services/db";

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

describe("Parts Catalogue APIs", () => {
  const mockPartDbRecord = {
    id: "ind-001",
    name: "Hydraulic Cylinder Seal Kit",
    partNumber: "DEMO-NH-SK80",
    manufacturer: "Northfield Hydraulics",
    domain: "industrial",
    category: "Seals & Gaskets",
    description: "Replacement seal set for hydraulic cylinders.",
    availability: "in_stock",
    typicalApplications: ["Hydraulic press cylinders"],
    keywords: ["hydraulic", "seal"],
    isDemo: true,
    specs: [
      { id: "s1", partId: "ind-001", label: "Bore diameter", value: "80 mm", unit: "mm" },
    ],
    sourceClaims: [
      {
        id: "c1",
        label: "Bore diameter",
        claimedValue: "80 mm",
        unit: "mm",
        evidence: "Spec sheet",
        sourceRecord: {
          id: "src1",
          name: "Northfield Catalog",
          url: "https://example.com/demo-catalogue/ind-001",
          isVerified: false,
        },
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/parts/search returns search results with pagination and formatted fields", async () => {
    vi.spyOn(prisma.part, "count").mockResolvedValueOnce(1);
    vi.spyOn(prisma.part, "findMany").mockResolvedValueOnce([mockPartDbRecord as any]);
    vi.spyOn(prisma.searchHistory, "create").mockResolvedValueOnce({} as any);

    const res = await request(app).get("/api/parts/search?query=hydraulic&domain=industrial&page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("total", 1);
    expect(res.body.data).toHaveProperty("page", 1);
    expect(res.body.data).toHaveProperty("totalPages", 1);
    expect(res.body.data.results).toHaveLength(1);
    expect(res.body.data.results[0]).toMatchObject({
      id: "ind-001",
      name: "Hydraulic Cylinder Seal Kit",
      domain: "industrial",
      availability: "in_stock",
      source: {
        name: "Northfield Catalog",
        url: "https://example.com/demo-catalogue/ind-001",
      },
    });
    expect(res.body.data.results[0].specs).toEqual([
      { label: "Bore diameter", value: "80 mm", unit: "mm" },
    ]);
  });

  it("GET /api/parts/search validates query params and rejects invalid domain", async () => {
    const res = await request(app).get("/api/parts/search?domain=invalid_domain");
    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
  });

  it("GET /api/parts/search validates pagination limits (limit <= 100)", async () => {
    const res = await request(app).get("/api/parts/search?limit=500");
    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
  });

  it("GET /api/parts/:id returns 200 and part record when found", async () => {
    vi.spyOn(prisma.part, "findUnique").mockResolvedValueOnce(mockPartDbRecord as any);

    const res = await request(app).get("/api/parts/ind-001");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("id", "ind-001");
    expect(res.body.data).toHaveProperty("manufacturer", "Northfield Hydraulics");
  });

  it("GET /api/parts/:id returns 404 when part is not found", async () => {
    vi.spyOn(prisma.part, "findUnique").mockResolvedValueOnce(null);

    const res = await request(app).get("/api/parts/non-existent-id");
    expect(res.status).toBe(404);
    expect(res.body.error).toHaveProperty("code", "PART_NOT_FOUND");
  });

  it("GET /api/parts/compare?ids=... returns list of parts", async () => {
    vi.spyOn(prisma.part, "findMany").mockResolvedValueOnce([mockPartDbRecord as any]);

    const res = await request(app).get("/api/parts/compare?ids=ind-001,ind-002");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty("id", "ind-001");
  });

  it("GET /api/parts/compare without ids returns 400 validation error", async () => {
    const res = await request(app).get("/api/parts/compare");
    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
  });

  it("Handles database failures safely through centralized errorHandler", async () => {
    vi.spyOn(prisma.part, "count").mockRejectedValueOnce(new Error("PostgreSQL connection failure"));
    vi.spyOn(prisma.part, "findMany").mockResolvedValueOnce([]);

    const res = await request(app).get("/api/parts/search?query=hydraulic");
    expect(res.status).toBe(500);
    expect(res.body.error).toHaveProperty("code", "INTERNAL_ERROR");
    expect(res.body.error).toHaveProperty("message", "PostgreSQL connection failure");
  });
});
