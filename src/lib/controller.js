import { pool } from "./db.js";

const tableName = "hackathon";

export function check() {
  pool.query(`SELECT NOW() AS now`)
}

