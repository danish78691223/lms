import mongoose from "mongoose";
const { Schema, model } = mongoose;

const userSchema = new Schema({
  userId: { type: String, unique: true, sparse: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["ADMIN", "STUDENT"], required: true },
  fullName: { type: String, required: true, trim: true },
  fatherName: String, phone: String, whatsapp: String, email: String,
  gender: String, dateOfBirth: Date, address: String, city: String,
  profilePhoto: String, notes: String, batch: String,
  courses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
  startDate: Date, active: { type: Boolean, default: true },
  forcePasswordChange: { type: Boolean, default: false },
  completedLessons: [{ type: Schema.Types.ObjectId, ref: "Lesson" }]
}, { timestamps: true });

const monthSchema = new Schema({
  number: { type: Number, min: 1, max: 8, required: true },
  title: { type: String, required: true },
  description: String, level: String, goals: [String],
  status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
  order: { type: Number, default: 0 }
}, { _id: true });

const courseSchema = new Schema({
  name: { type: String, enum: ["English", "Arabic", "Urdu"], unique: true },
  code: { type: String, unique: true },
  description: String,
  months: [monthSchema]
}, { timestamps: true });

const lessonSchema = new Schema({
  course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
  monthId: { type: Schema.Types.ObjectId, required: true },
  week: { type: Number, default: 1 },
  title: { type: String, required: true },
  description: String, content: String,
  status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
  order: { type: Number, default: 0 }
}, { timestamps: true });

const materialSchema = new Schema({
  title: { type: String, required: true }, description: String,
  course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
  month: Number, week: Number,
  type: { type: String, enum: ["PDF","DOC","PPT","IMAGE","AUDIO","VIDEO","LINK","TEXT"], default: "TEXT" },
  url: String, textContent: String, downloadable: { type: Boolean, default: false },
  status: { type: String, enum: ["DRAFT","PUBLISHED"], default: "DRAFT" },
  batches: [String], studentIds: [{ type: Schema.Types.ObjectId, ref: "User" }]
}, { timestamps: true });

const lectureSchema = new Schema({
  title: { type: String, required: true }, course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
  month: Number, topic: String, teacher: String, date: { type: Date, required: true },
  startTime: String, endTime: String, mode: { type: String, enum: ["LIVE","RECORDED"], default: "LIVE" },
  meetingLink: String, recordingUrl: String, batch: String, description: String,
  status: { type: String, enum: ["SCHEDULED","RESCHEDULED","CANCELLED","COMPLETED"], default: "SCHEDULED" }
}, { timestamps: true });

const assignmentSchema = new Schema({
  title: String, description: String, course: { type: Schema.Types.ObjectId, ref: "Course" },
  dueDate: Date, type: { type: String, enum: ["ASSIGNMENT","QUIZ","TEST"], default: "ASSIGNMENT" },
  questions: [{ prompt: String, options: [String], answer: String, kind: String }],
  status: { type: String, enum: ["DRAFT","PUBLISHED"], default: "DRAFT" }
}, { timestamps: true });

const submissionSchema = new Schema({
  assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
  student: { type: Schema.Types.ObjectId, ref: "User", required: true },
  answerText: String, fileUrl: String, marks: Number, maxMarks: Number, feedback: String, submittedAt: Date
}, { timestamps: true });
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

const attendanceSchema = new Schema({
  lecture: { type: Schema.Types.ObjectId, ref: "Lecture", required: true },
  student: { type: Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["PRESENT","ABSENT","LATE"], default: "PRESENT" }
}, { timestamps: true });
attendanceSchema.index({ lecture: 1, student: 1 }, { unique: true });

const announcementSchema = new Schema({
  title: String, body: String, pinned: { type: Boolean, default: false },
  courses: [{ type: Schema.Types.ObjectId, ref: "Course" }], batches: [String],
  status: { type: String, enum: ["DRAFT","PUBLISHED"], default: "PUBLISHED" }
}, { timestamps: true });

const instituteSettingSchema = new Schema({
  key: { type: String, unique: true, default: "main" },
  instituteName: { type: String, default: "Lingo Institute" },
  logoUrl: String,
  contactEmail: String,
  contactPhone: String,
  address: String,
  theme: { type: String, enum: ["sage", "teal"], default: "sage" },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

const activitySchema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: "User" }, action: String, target: String, details: String
}, { timestamps: true });

export const User = model("User", userSchema);
export const Course = model("Course", courseSchema);
export const Lesson = model("Lesson", lessonSchema);
export const Material = model("Material", materialSchema);
export const Lecture = model("Lecture", lectureSchema);
export const Assignment = model("Assignment", assignmentSchema);
export const Submission = model("Submission", submissionSchema);
export const Attendance = model("Attendance", attendanceSchema);
export const Announcement = model("Announcement", announcementSchema);
export const Activity = model("Activity", activitySchema);
export const InstituteSetting = model("InstituteSetting", instituteSettingSchema);
