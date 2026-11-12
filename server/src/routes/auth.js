import { Router } from "express";
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
  const token = jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "1d" });
  res.cookie("lms_token", token, cookieOptions());
  res.json({ user: { id: user._id, userId: user.userId, fullName: user.fullName, role: user.role, forcePasswordChange: user.forcePasswordChange } });
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
  await user.save();
  res.json({ message: "Password updated" });
});
export default router;
