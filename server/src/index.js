import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import { authenticate, allow } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import studentRoutes from "./routes/student.js";

const app = express();
// Render terminates TLS and forwards requests through one trusted proxy hop.
app.set("trust proxy", 1);
// Keep the known production Vercel URL in the allow-list and add any custom domains via CLIENT_ORIGIN.
const configuredOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const allowedOrigins = new Set(["https://lms-fawn-theta.vercel.app", "http://localhost:5173", ...configuredOrigins]);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    console.error("[CORS] Rejected origin:", origin, "| Allowed origins:", [...allowedOrigins].join(", "));
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use("/api/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", authenticate, allow("ADMIN"), adminRoutes);
app.use("/api/student", authenticate, allow("STUDENT"), studentRoutes);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});
const port = process.env.PORT || 5000;
connectDB()
  .then(() => app.listen(port, () => console.log("API listening on " + port)))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
