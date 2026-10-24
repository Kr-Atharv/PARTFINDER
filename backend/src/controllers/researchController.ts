// src/controllers/researchController.ts
import { Request, Response, NextFunction } from "express";
import { ResearchSearchRequest, ResearchProgressEvent } from "../schemas/researchSchemas";
import { TinyFishService } from "../services/tinyFishService";

export class ResearchController {
  static async search(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as ResearchSearchRequest;
      const records = await TinyFishService.conductResearch(body);

      return res.json({
        data: {
          query: body.query,
          domain: body.domain,
          totalResearched: records.length,
          results: records,
          parts: records,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Same research pipeline as `search`, but streams real progress as newline-delimited JSON:
   *   {"type":"started"|"search_done"|"fetch_done"|"page_processed"|"persisted", ...}
   *   {"type":"complete","data":{...same shape as /search...}}   or
   *   {"type":"error","error":{message,code,status}}
   * Every event reflects something the pipeline actually did; nothing is simulated.
   */
  static async stream(req: Request, res: Response) {
    const body = req.body as ResearchSearchRequest;
    let closed = false;
    res.on("close", () => {
      closed = true;
    });

    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const write = (payload: unknown) => {
      if (closed || res.writableEnded) return;
      res.write(`${JSON.stringify(payload)}\n`);
    };

    try {
      const records = await TinyFishService.conductResearch(body, (event: ResearchProgressEvent) => write(event));
      write({
        type: "complete",
        data: {
          query: body.query,
          domain: body.domain,
          totalResearched: records.length,
          results: records,
        },
      });
    } catch (err: any) {
      write({
        type: "error",
        error: {
          message: err?.message || "Research failed.",
          code: err?.code || "INTERNAL_ERROR",
          status: err?.status || 500,
        },
      });
    } finally {
      if (!res.writableEnded) res.end();
    }
  }
}
