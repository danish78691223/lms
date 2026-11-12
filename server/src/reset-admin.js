import "dotenv/config";
import readline from "node:readline";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "./config/db.js";
import { User } from "./models/index.js";

function askLine(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

function askHidden(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Run this command from an interactive terminal so the password can be entered securely.");
  }
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    let value = "";
    process.stdout.write(question);
    input.setRawMode(true);
    input.resume();

    const cleanup = () => {
      input.removeListener("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Password reset cancelled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (char >= " " && char !== "\u007f") value += char;
      }
    };
    input.on("data", onData);
  });
}

let exitCode = 0;
try {
  const userIdInput = await askLine("Admin user ID [admin]: ");
  const userId = userIdInput || "admin";
  const password = await askHidden("New password (minimum 12 characters): ");
  if (password.length < 12) throw new Error("Use a password with at least 12 characters.");
  const confirmation = await askHidden("Confirm new password: ");
  if (password !== confirmation) throw new Error("Passwords do not match.");

  await connectDB();
  const admin = await User.findOne({ userId, role: "ADMIN" });
  if (!admin) throw new Error('No ADMIN account found with user ID "' + userId + '". No records were changed.');

  admin.passwordHash = await bcrypt.hash(password, 12);
  admin.forcePasswordChange = false;
  await admin.save();

  console.log('Admin password reset successfully for "' + userId + '".');
  console.log("No student, course, lesson, material, lecture, attendance, or submission records were modified.");
} catch (error) {
  exitCode = 1;
  console.error("Admin password reset failed:", error.message);
} finally {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => {});
  }
  process.exitCode = exitCode;
}
