import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { User } from "./models/index.js";

const userId = process.env.ADMIN_USER_ID || "admin";
const password = process.env.ADMIN_INITIAL_PASSWORD;
const fullName = process.env.ADMIN_FULL_NAME || "Institute Administrator";
if (!password || password.length < 12) {
  throw new Error("Set ADMIN_INITIAL_PASSWORD to a value with at least 12 characters.");
}
await connectDB();
const passwordHash = await bcrypt.hash(password, 12);
const admin = await User.findOneAndUpdate(
  { userId },
  { userId, fullName, role: "ADMIN", passwordHash, active: true, forcePasswordChange: true },
  { upsert: true, new: true, runValidators: true },
);
console.log("Admin account is ready: " + admin.userId);
console.log("Change the initial password after first login.");
await mongoose.disconnect();
