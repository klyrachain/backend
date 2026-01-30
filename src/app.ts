import express, { type Express } from "express";
import routes from "./routes/index.js";

const app: Express = express();

app.use(express.json());
app.use("/api", routes);

export default app;
