import connectDB from "./db/index.js";
import { config } from "dotenv";

config();

connectDB();
