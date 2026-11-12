import { Course } from "../models/index.js";

const courseDefinitions = [
  ["English", "ENG"],
  ["Arabic", "ARA"],
  ["Urdu", "URD"],
];
const monthTitles = [
  "Foundations",
  "Everyday Communication",
  "Core Grammar",
  "Practical Fluency",
  "Intermediate Skills",
  "Confident Communication",
  "Advanced Expression",
  "Mastery & Review",
];

export async function ensureDefaultCourses() {
  for (const [name, code] of courseDefinitions) {
    const existing = await Course.findOne({ code });
    if (existing) continue;

    const months = Array.from({ length: 8 }, (_, index) => ({
      number: index + 1,
      title: `Month ${index + 1} — ${monthTitles[index]}`,
      description: `${name} learning plan for month ${index + 1}.`,
      level: index < 2 ? "Beginner" : index < 4 ? "Elementary" : index < 6 ? "Intermediate" : "Advanced",
      goals: [
        `Build ${name} vocabulary`,
        "Practice listening and speaking",
        "Review grammar and writing",
      ],
      status: "PUBLISHED",
    }));

    try {
      await Course.create({
        name,
        code,
        description: `Eight-month ${name} language programme.`,
        months,
      });
      console.log(`[setup] Created default ${name} course with 8 months.`);
    } catch (error) {
      // A duplicate-key race is safe: the matching course has already been created.
      if (error?.code !== 11000) throw error;
      console.log(`[setup] ${name} course already exists; leaving it unchanged.`);
    }
  }
}
