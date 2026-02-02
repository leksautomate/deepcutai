
import dotenv from "dotenv";
import path from "path";

// Load .env.local first (if exists) so it takes precedence over .env
dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true });
dotenv.config();
