import app from "./app.js";
import { env } from "./config/env.js";

const port = env.port;
const host = "0.0.0.0";

try {
  await app.listen({ port, host });
  app.log.info({ port, host }, "Server listening");
} catch (error) {
  app.log.error({ err: error }, "Failed to start server");
  process.exit(1);
}
