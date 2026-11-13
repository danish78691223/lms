import { Router } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/index.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
const secureCookie = process.env.COOKIE_SECURE === "true";
const cookieSameSite = "lax"; // Production API is same-origin through the Vercel rewrite.
const cookieOptions = () => ({
  httpOnly: true,
  secure: secureCookie,
  sameSite: cookieSameSite,
  maxAge: 86400000,
  path: "/",
});

router.post("/login", async (req, res) => {
  const parsed = z.object({ userId: z.string().min(1), password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter your user ID and password" });
  const user = await User.findOne({ userId: parsed.data.userId.trim() });
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash)))
    return res.status(401).json({ message: "Incorrect credentials or inactive account" });
  const token = jwt.sign({ sub: user._id, role: user.role, ver: user.passwordVersion || 0 }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "1d" });
  res.cookie("lms_token", token, cookieOptions());
  res.json({ user: { id: user._id, userId: user.userId, fullName: user.fullName, role: user.role, forcePasswordChange: user.forcePasswordChange } });
});

router.post("/admin-password-reset", rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
  const configuredKey = process.env.ADMIN_PASSWORD_RESET_KEY || "";
  if (!configuredKey) {
    return res.status(503).json({ message: "Admin password reset is disabled. Configure the reset key in Render first." });
  }

  const parsed = z.object({
    resetKey: z.string().min(32).max(256),
    newPassword: z.string().min(12).max(128),
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Enter the reset key and a password of at least 12 characters." });
  }

  const received = Buffer.from(parsed.data.resetKey, "utf8");
  const expected = Buffer.from(configuredKey, "utf8");
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return res.status(401).json({ message: "Invalid reset key." });
  }

  const resetKeyHash = crypto.createHash("sha256").update(received).digest("hex");
  const admin = await User.findOne({ userId: "admin", role: "ADMIN" }).select("+lastAdminResetKeyHash");
  if (!admin || !admin.active) {
    return res.status(404).json({ message: "Active admin account was not found." });
  }
  if (admin.lastAdminResetKeyHash === resetKeyHash) {
    return res.status(409).json({ message: "This reset key has already been used. Configure a new key in Render." });
  }

  admin.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  admin.forcePasswordChange = false;
  admin.passwordVersion = Number(admin.passwordVersion || 0) + 1;
  admin.lastAdminResetKeyHash = resetKeyHash;
  await admin.save();

  // Disable this reset key for the current running instance. The stored hash also
  // prevents reuse of this same key after a service restart.
  process.env.ADMIN_PASSWORD_RESET_KEY = "";

  res.json({ message: "Admin password reset successfully. Sign in with your new password." });
});

router.post("/logout", (req, res) => {
  res.clearCookie("lms_token", {
    httpOnly: true,
    sameSite: cookieSameSite,
    secure: secureCookie,
    path: "/",
  });
  res.json({ message: "Logged out" });
});
router.get("/me", authenticate, (req, res) => res.json({ user: req.user }));
router.post("/change-password", authenticate, async (req, res) => {
  const parsed = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "New password must contain at least 10 characters" });
  const user = await User.findById(req.user._id);
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) return res.status(400).json({ message: "Current password is incorrect" });
  user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  user.forcePasswordChange = false;
  user.passwordVersion = Number(user.passwordVersion || 0) + 1;
  await user.save();
  const token = jwt.sign({ sub: user._id, role: user.role, ver: user.passwordVersion }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "1d" });
  res.cookie("lms_token", token, cookieOptions());
  res.json({ message: "Password updated" });
});
export default router;
