import express from "express";
import dotenv from "dotenv";
import baseRoute from "./routes/base.js";
import authRoutes from "./routes/auth.js";
import batchRoutes from "./routes/batches.js";
import attachmentRoutes from "./routes/attachments.js";
import { corsConfig } from "./middleware/cors.js";
import cookieParser from "cookie-parser";
import swaggerUi from 'swagger-ui-express';
import YAML from "yaml";
import fs from "fs";
import { restrictInProd } from "./middleware/restrict.js";

const app = express();
const file = fs.readFileSync("swagger.yaml", "utf8");
const swaggerDocument = YAML.parse(file);
dotenv.config();

app.use(corsConfig);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser())

app.use("/hackathon/v1", restrictInProd, baseRoute);
app.use("/hackathon/v1/auth", authRoutes);
app.use("/hackathon/v1/batches", batchRoutes);
app.use("/hackathon/v1/attachments", attachmentRoutes);
app.use('/hackathon/v1/docs', restrictInProd, swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" })
})

export default app;
