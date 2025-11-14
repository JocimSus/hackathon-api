import express from "express";
import dotenv from "dotenv";
import hackathonRoutes from "./routes/hackathon.js";

const app = express();
// dotenv.config();

app.use("/hackathon/api/v1", hackathonRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" })
})

export default app;
