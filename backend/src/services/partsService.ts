// src/services/partsService.ts
import { prisma } from "./db";
import { SearchPartsQuery } from "../schemas/partsSchemas";
import { Prisma } from "@prisma/client";

export class PartsService {
  /**
   * Search parts with relational filters, keyword/text matching, sorting and pagination
   */
  static async searchParts(params: SearchPartsQuery) {
    const {
      query,
      domain,
      manufacturer,
      category,
      model,
      availability,
      page = 1,
      limit = 20,
      sort = "name-asc",
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.PartWhereInput = {};

    if (domain) {
      where.domain = domain;
    }

    if (manufacturer && manufacturer.trim()) {
      where.manufacturer = {
        contains: manufacturer.trim(),
        mode: "insensitive",
      };
    }

    if (category && category.trim()) {
      where.category = {
        contains: category.trim(),
        mode: "insensitive",
      };
    }

    if (availability) {
      where.availability = availability;
    }

    // Free text query matching name, partNumber, description, keywords
    const searchConditions: Prisma.PartWhereInput[] = [];

    if (query && query.trim()) {
      const q = query.trim();
      searchConditions.push(
        { name: { contains: q, mode: "insensitive" } },
        { partNumber: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { keywords: { has: q } }
      );
    }

    // Model parameter matches typicalApplications
    if (model && model.trim()) {
      const m = model.trim();
      where.typicalApplications = { has: m };
    }

    if (searchConditions.length > 0) {
      where.OR = searchConditions;
    }

    // Sorting
    let orderBy: Prisma.PartOrderByWithRelationInput = { name: "asc" };
    switch (sort) {
      case "name-desc":
        orderBy = { name: "desc" };
        break;
      case "manufacturer-asc":
        orderBy = { manufacturer: "asc" };
        break;
      case "manufacturer-desc":
        orderBy = { manufacturer: "desc" };
        break;
      default:
        orderBy = { name: "asc" };
        break;
    }

    const [total, records] = await Promise.all([
      prisma.part.count({ where }),
      prisma.part.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          specs: true,
          sourceClaims: {
            include: {
              sourceRecord: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      results: records.map(this.formatPartRecord),
    };
  }

  /**
   * Find a single part by ID with its specifications, sources, and claims
   */
  static async getPartById(id: string) {
    const record = await prisma.part.findUnique({
      where: { id },
      include: {
        specs: true,
        sourceClaims: {
          include: {
            sourceRecord: true,
          },
        },
      },
    });

    if (!record) return null;
    return this.formatPartRecord(record);
  }

  /**
   * Get multiple parts by IDs for comparison
   */
  static async compareParts(ids: string[]) {
    if (ids.length === 0) return [];

    const records = await prisma.part.findMany({
      where: {
        id: { in: ids },
      },
      include: {
        specs: true,
        sourceClaims: {
          include: {
            sourceRecord: true,
          },
        },
      },
    });

    // Preserve the order of requested IDs
    const idMap = new Map(records.map((r) => [r.id, this.formatPartRecord(r)]));
    return ids.map((id) => idMap.get(id)).filter(Boolean);
  }

  /**
   * Formats a Prisma Part record into the frontend Part interface
   * preserving source information and specification claims
   */
  private static formatPartRecord(part: any) {
    // Determine the primary source from sourceClaims or fallback
    let sourceName = "Demo catalogue (placeholder)";
    let sourceUrl: string | undefined = undefined;

    if (part.sourceClaims && part.sourceClaims.length > 0) {
      const primaryClaim = part.sourceClaims[0];
      if (primaryClaim.sourceRecord) {
        sourceName = primaryClaim.sourceRecord.name;
        sourceUrl = primaryClaim.sourceRecord.url || undefined;
      }
    } else {
      sourceUrl = `https://example.com/demo-catalogue/${part.id}`;
    }

    return {
      id: part.id,
      name: part.name,
      partNumber: part.partNumber,
      manufacturer: part.manufacturer,
      domain: part.domain,
      category: part.category,
      description: part.description,
      availability: part.availability,
      usedIn: part.typicalApplications,
      keywords: part.keywords,
      isDemo: part.isDemo,
      specs: (part.specs || []).map((s: any) => ({
        label: s.label,
        value: s.value,
        unit: s.unit || undefined,
      })),
      source: {
        name: sourceName,
        url: sourceUrl,
      },
      sourceClaims: (part.sourceClaims || []).map((claim: any) => ({
        id: claim.id,
        label: claim.label,
        claimedValue: claim.claimedValue,
        unit: claim.unit,
        evidence: claim.evidence,
        source: {
          id: claim.sourceRecord?.id,
          name: claim.sourceRecord?.name,
          url: claim.sourceRecord?.url,
          isVerified: claim.sourceRecord?.isVerified,
        },
      })),
    };
  }
}
