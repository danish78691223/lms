import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { User } from "./models/index.js";

const userId = process.env.ADMIN_USER_ID || "admin";
const password = process.env.ADMIN_INITIAL_PASSWORD;
const fullName = process.env.ADMIN_FULL_NAME || "Institute Administrator";

await connectDB();
const existingAdmin = await User.findOne({ userId, role: "ADMIN" });
if (existingAdmin) {
  console.log("Admin account already exists: " + userId + ". No changes made.");
  await mongoose.disconnect();
  process.exit(0);
}
if (!password || password.length < 12) {
  await mongoose.disconnect();
  throw new Error("Set ADMIN_INITIAL_PASSWORD in Render. It must contain at least 12 characters.");
}

const passwordHash = await bcrypt.hash(password, 12);
const admin = await User.create({
  userId,
  fullName,
  role: "ADMIN",
  passwordHash,
  active: true,
  forcePasswordChange: true,
});
console.log("Admin account created successfully: " + admin.userId);
console.log("The temporary password was read from ADMIN_INITIAL_PASSWORD. Change it after first login.");
await mongoose.disconnect();
