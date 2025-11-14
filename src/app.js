import express from "express";
import dotenv from "dotenv";
import hackathonRoutes from "./routes/hackathon.js";
import { corsConfig } from "./middleware/cors.js";

const app = express();
dotenv.config();

app.use(corsConfig);
app.use(express.text());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/hackathon/v1", hackathonRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" })
})

export default app;
