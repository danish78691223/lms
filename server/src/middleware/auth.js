import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
export async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.lms_token || req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ message: "Please log in" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user || !user.active) return res.status(401).json({ message: "Account unavailable" });
    req.user = user;
    next();
  } catch { return res.status(401).json({ message: "Invalid or expired session" }); }
}
export const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ message: "Forbidden" });
