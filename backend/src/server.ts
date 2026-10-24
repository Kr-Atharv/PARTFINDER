// src/server.ts
import app from "./app";
import http from "http";
import { config } from "./config";
import { logger } from "./utils/logger";

const port = config.PORT || 4000;
const server = http.createServer(app);

server.listen(port, () => {
  logger.info(`🚀 Server listening on http://localhost:${port}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});
