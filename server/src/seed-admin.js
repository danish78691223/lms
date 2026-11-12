import "dotenv/config";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { User } from "./models/index.js";

const userId = process.env.ADMIN_USER_ID || "admin";
const fullName = process.env.ADMIN_FULL_NAME || "Institute Administrator";

await connectDB();
const existingAdmin = await User.findOne({ userId, role: "ADMIN" });
if (existingAdmin) {
  console.log("Admin account already exists: " + userId + ". No changes made.");
  await mongoose.disconnect();
  process.exit(0);
}

const password = process.env.ADMIN_INITIAL_PASSWORD || (crypto.randomBytes(18).toString("base64url") + "A7!");
const passwordHash = await bcrypt.hash(password, 12);
const admin = await User.create({
  userId,
  fullName,
  role: "ADMIN",
  passwordHash,
  active: true,
  forcePasswordChange: true,
});
console.log("========== NEW ADMIN ACCOUNT CREATED ==========");
console.log("User ID: " + admin.userId);
console.log("Temporary password: " + password);
console.log("Copy this password now. It will not be printed again.");
console.log("================================================");
await mongoose.disconnect();
