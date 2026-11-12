import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB } from "./config/db.js";
import { User, Course } from "./models/index.js";
await connectDB();
const adminHash = await bcrypt.hash("Admin@12345", 12);
await User.findOneAndUpdate(
  { userId: "admin" },
  {
    userId: "admin",
    fullName: "Institute Administrator",
    role: "ADMIN",
    passwordHash: adminHash,
    active: true,
    forcePasswordChange: false,
  },
  { upsert: true },
);
const specs = [
  ["English", "ENG"],
  ["Arabic", "ARA"],
  ["Urdu", "URD"],
];
const courses = [];
for (const [name, code] of specs) {
  const months = Array.from({ length: 8 }, (_, i) => ({
    number: i + 1,
    title: `Month ${i + 1} — ${["Foundations", "Everyday Communication", "Core Grammar", "Practical Fluency", "Intermediate Skills", "Confident Communication", "Advanced Expression", "Mastery & Review"][i]}`,
    description: `${name} learning plan for month ${i + 1}.`,
    level:
      i < 2
        ? "Beginner"
        : i < 4
          ? "Elementary"
          : i < 6
            ? "Intermediate"
            : "Advanced",
    goals: [
      `Build ${name} vocabulary`,
      `Practice listening and speaking`,
      `Review grammar and writing`,
    ],
    status: "PUBLISHED",
  }));
  const c = await Course.findOneAndUpdate(
    { code },
    {
      name,
      code,
      description: `Eight-month ${name} language programme.`,
      months,
    },
    { upsert: true, new: true },
  );
  courses.push(c);
}
const demo = [
  ["LMS-ENG-2026-001", "Aarav Sharma", courses[0]],
  ["LMS-ARA-2026-002", "Sara Khan", courses[1]],
  ["LMS-URD-2026-003", "Zoya Ali", courses[2]],
];
for (const [userId, fullName, course] of demo) {
  await User.findOneAndUpdate(
    { userId },
    {
      userId,
      fullName,
      role: "STUDENT",
      passwordHash: await bcrypt.hash("Student@12345", 12),
      courses: [course._id],
      batch: "2026-A",
      active: true,
      forcePasswordChange: true,
    },
    { upsert: true },
  );
}
console.log("Seed complete. Admin: admin / Admin@12345");
process.exit(0);
