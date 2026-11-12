import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, Course, Lesson, Material, Lecture, Assignment, Submission, Attendance, Announcement, Activity, InstituteSetting } from "../models/index.js";
import { audit } from "../utils/audit.js";
import { ensureDefaultCourses } from "../utils/ensureDefaultCourses.js";
const router = Router();
const studentInput = z.object({
  fullName: z.string().min(2), fatherName: z.string().optional(), phone: z.string().optional(),
  whatsapp: z.string().optional(), email: z.string().email().optional().or(z.literal("")),
  gender: z.string().optional(), dateOfBirth: z.string().optional(), address: z.string().optional(), profilePhoto: z.string().optional(),
  city: z.string().optional(), batch: z.string().optional(), startDate: z.string().optional(),
  notes: z.string().optional(), courses: z.array(z.string()).min(1), customUserId: z.string().optional(),
  customPassword: z.string().optional()
});
function makePassword() { return crypto.randomBytes(9).toString("base64url") + "A7!"; }
router.get("/dashboard", async (req,res) => {
  const [totalStudents, activeStudents, materialsUploaded, lectures, recentActivity] = await Promise.all([
    User.countDocuments({ role:"STUDENT" }), User.countDocuments({ role:"STUDENT", active:true }),
    Material.countDocuments(), Lecture.find({ date: { $gte: new Date() }, status: { $ne:"CANCELLED" } }).populate("course","name").sort({date:1}).limit(5),
    Activity.find().sort({createdAt:-1}).limit(8).populate("actor","fullName")
  ]);
  res.json({ totalStudents, activeStudents, materialsUploaded, upcomingLectures:lectures, totalLecturesThisWeek:await Lecture.countDocuments({date:{$gte:new Date(),$lte:new Date(Date.now()+7*86400000)}}), recentActivity });
});
router.get("/students", async (req,res) => {
  const { q="", course="", batch="", status="", page=1, limit=20 } = req.query;
  const filter = { role:"STUDENT" };
  if (q) filter.$or = ["fullName","userId","phone","email"].map(k=>({[k]:{$regex:q,$options:"i"}}));
  if (course) filter.courses = course;
  if (batch) filter.batch = batch;
  if (status === "active") filter.active = true;
  if (status === "inactive") filter.active = false;
  const p = Math.max(1,Number(page)), l = Math.min(100,Math.max(1,Number(limit)));
  const [items,total] = await Promise.all([User.find(filter).select("-passwordHash").populate("courses","name code").sort({createdAt:-1}).skip((p-1)*l).limit(l),User.countDocuments(filter)]);
  res.json({items,total,page:p,pages:Math.ceil(total/l)});
});
router.post("/students", async (req,res) => {
  const parsed = studentInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({message:parsed.error.issues[0].message});
  const data = parsed.data, courses = await Course.find({_id:{$in:data.courses}});
  if (courses.length !== data.courses.length) return res.status(400).json({message:"Invalid course selection"});
  const code = courses[0].code || "GEN";
  const count = await User.countDocuments({role:"STUDENT"});
  const userId = data.customUserId?.trim() || `LMS-${code}-${new Date().getFullYear()}-${String(count+1).padStart(3,"0")}`;
  if (await User.exists({userId})) return res.status(409).json({message:"Student ID already exists"});
  const password = data.customPassword || makePassword();
  if (password.length < 10) return res.status(400).json({message:"Password must be at least 10 characters"});
  const user = await User.create({...data,userId,passwordHash:await bcrypt.hash(password,12),role:"STUDENT",courses:data.courses,forcePasswordChange:true});
  await audit(req.user._id,"CREATE_STUDENT","User",userId);
  res.status(201).json({student:{id:user._id,userId:user.userId,fullName:user.fullName},credentials:{userId,password}});
});
router.post("/students/bulk", async (req,res) => {
  const rows = req.body?.students;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 500)
    return res.status(400).json({ message: "Upload between 1 and 500 student rows" });
  let nextNumber = await User.countDocuments({ role: "STUDENT" }) + 1;
  const results = [];
  for (let index = 0; index < rows.length; index++) {
    const parsed = studentInput.safeParse(rows[index]);
    if (!parsed.success) {
      results.push({ row: index + 2, success: false, message: parsed.error.issues[0].message });
      continue;
    }
    const data = parsed.data;
    const courseDocs = await Course.find({ _id: { $in: data.courses } });
    if (courseDocs.length !== data.courses.length) {
      results.push({ row: index + 2, success: false, message: "Invalid course selection" });
      continue;
    }
    const code = courseDocs[0].code || "GEN";
    const userId = data.customUserId?.trim() || `LMS-${code}-${new Date().getFullYear()}-${String(nextNumber).padStart(3,"0")}`;
    if (await User.exists({ userId })) {
      results.push({ row: index + 2, success: false, message: "Student ID already exists: " + userId });
      continue;
    }
    const password = data.customPassword || makePassword();
    if (password.length < 10) {
      results.push({ row: index + 2, success: false, message: "Password must be at least 10 characters" });
      continue;
    }
    try {
      const user = await User.create({
        ...data,
        userId,
        passwordHash: await bcrypt.hash(password, 12),
        role: "STUDENT",
        courses: data.courses,
        forcePasswordChange: true,
      });
      await audit(req.user._id, "BULK_CREATE_STUDENT", "User", userId);
      results.push({ row: index + 2, success: true, student: { fullName: user.fullName, userId }, credentials: { userId, password } });
      nextNumber++;
    } catch (error) {
      results.push({ row: index + 2, success: false, message: error.code === 11000 ? "Duplicate student ID" : "Could not create this student" });
    }
  }
  res.status(201).json({
    created: results.filter(x => x.success).length,
    failed: results.filter(x => !x.success).length,
    results,
  });
});
router.patch("/students/:id", async (req,res) => {
  const allowed = ["fullName","fatherName","phone","whatsapp","email","gender","dateOfBirth","address","city","batch","startDate","notes","courses","active"];
  const update = Object.fromEntries(Object.entries(req.body).filter(([k])=>allowed.includes(k)));
  const student = await User.findOneAndUpdate({_id:req.params.id,role:"STUDENT"},update,{new:true,runValidators:true}).select("-passwordHash").populate("courses","name");
  if (!student) return res.status(404).json({message:"Student not found"});
  await audit(req.user._id,"UPDATE_STUDENT","User",student.userId);
  res.json({student});
});
router.post("/students/:id/reset-password", async (req,res) => {
  const password = makePassword(), hash = await bcrypt.hash(password,12);
  const student = await User.findOneAndUpdate({_id:req.params.id,role:"STUDENT"},{passwordHash:hash,forcePasswordChange:true});
  if (!student) return res.status(404).json({message:"Student not found"});
  await audit(req.user._id,"RESET_PASSWORD","User",student.userId);
  res.json({credentials:{userId:student.userId,password}});
});
router.delete("/students/:id", async (req,res) => {
  const student = await User.findOneAndDelete({_id:req.params.id,role:"STUDENT"});
  if (!student) return res.status(404).json({message:"Student not found"});
  await audit(req.user._id,"DELETE_STUDENT","User",student.userId);
  res.json({message:"Student deleted"});
});
router.get("/courses", async (req,res)=>{
  await ensureDefaultCourses();
  res.json(await Course.find().sort({name:1}));
});
router.post("/courses/:id/months", async (req,res)=>{
  const course = await Course.findById(req.params.id); if(!course) return res.status(404).json({message:"Course not found"});
  const month = Number(req.body.number);
  if(month<1||month>8) return res.status(400).json({message:"Month must be between 1 and 8"});
  const existing=course.months.find(m=>m.number===month);
  if(existing) Object.assign(existing,req.body); else course.months.push(req.body);
  await course.save(); await audit(req.user._id,"UPSERT_MONTH","Course",`${course.name} month ${month}`);
  res.json(course);
});
router.patch("/courses/:id/months/:monthId", async (req,res)=>{
  const course=await Course.findById(req.params.id); if(!course) return res.status(404).json({message:"Course not found"});
  const month=course.months.id(req.params.monthId); if(!month) return res.status(404).json({message:"Month not found"});
  Object.assign(month,req.body); await course.save(); res.json(course);
});
router.get("/lessons", async (req,res)=>res.json(await Lesson.find().populate("course","name").sort({createdAt:-1})));
router.post("/lessons", async (req,res)=>{ const lesson=await Lesson.create(req.body); await audit(req.user._id,"CREATE_LESSON","Lesson",lesson.title); res.status(201).json(lesson); });
router.patch("/lessons/:id", async (req,res)=>{ const lesson=await Lesson.findByIdAndUpdate(req.params.id,req.body,{new:true}); res.json(lesson); });
router.post("/materials", async (req,res)=>{ const m=await Material.create(req.body); await audit(req.user._id,"CREATE_MATERIAL","Material",m.title); res.status(201).json(m); });
router.patch("/materials/:id", async (req,res)=>res.json(await Material.findByIdAndUpdate(req.params.id,req.body,{new:true})));
router.get("/materials", async (req,res)=>res.json(await Material.find().populate("course","name").sort({createdAt:-1})));
router.post("/lectures", async (req,res)=>{
  const payload = { ...req.body, status: "SCHEDULED" };
  const x = await Lecture.create(payload);
  await audit(req.user._id,"CREATE_LECTURE","Lecture",x.title);
  res.status(201).json(x);
});
router.post("/lectures/recurring", async (req, res) => {
  const { startDate, endDate, weekdays, utcOffsetMinutes = 0, ...lectureFields } = req.body || {};
  if (!startDate || !endDate || !Array.isArray(weekdays) || weekdays.length === 0)
    return res.status(400).json({ message: "Start date, end date and at least one weekday are required" });
  const start = new Date(String(startDate) + "T00:00:00.000Z");
  const end = new Date(String(endDate) + "T00:00:00.000Z");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start)
    return res.status(400).json({ message: "Invalid recurrence date range" });
  if ((end.getTime() - start.getTime()) / 86400000 > 90)
    return res.status(400).json({ message: "Weekly recurrence can be scheduled for up to 90 days at a time" });
  const days = new Set(weekdays.map(Number));
  if ([...days].some(day => !Number.isInteger(day) || day < 0 || day > 6))
    return res.status(400).json({ message: "Invalid weekday selection" });
  const course = await Course.findById(lectureFields.course);
  if (!course) return res.status(400).json({ message: "Select a valid course" });
  const time = String(lectureFields.startTime || "00:00");
  const hour = Number(time.slice(0, 2)), minute = Number(time.slice(3, 5));
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time))
    return res.status(400).json({ message: "Start time must use HH:MM format" });
  const offset = Number(utcOffsetMinutes);
  if (!Number.isInteger(offset) || offset < -840 || offset > 840)
    return res.status(400).json({ message: "Invalid local timezone offset" });
  const offsetSign = offset >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offset);
  const offsetText = offsetSign + String(Math.floor(absoluteOffset / 60)).padStart(2, "0") + ":" + String(absoluteOffset % 60).padStart(2, "0");
  const dates = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (days.has(cursor.getUTCDay())) {
      const dayText = cursor.toISOString().slice(0, 10);
      const date = new Date(`${dayText}T${time}:00${offsetText}`);
      dates.push(date);
    }
  }
  if (dates.length === 0) return res.status(400).json({ message: "No scheduled dates match these weekdays" });
  const lectures = await Lecture.insertMany(dates.map(date => ({ ...lectureFields, date, status: "SCHEDULED" })));
  await audit(req.user._id, "CREATE_RECURRING_LECTURES", "Lecture", `${lectureFields.title} (${lectures.length} sessions)`);
  res.status(201).json({ message: "Recurring lectures scheduled", count: lectures.length, lectures });
});
router.patch("/lectures/:id", async (req,res)=>{
  const allowed = ["title","topic","teacher","date","startTime","endTime","mode","meetingLink","recordingUrl","batch","description","month","status"];
  const update = Object.fromEntries(Object.entries(req.body || {}).filter(([key])=>allowed.includes(key)));
  if (update.status && !["SCHEDULED","RESCHEDULED","CANCELLED","COMPLETED"].includes(update.status))
    return res.status(400).json({message:"Invalid lecture status"});
  const lecture = await Lecture.findByIdAndUpdate(req.params.id,update,{new:true,runValidators:true}).populate("course","name");
  if(!lecture) return res.status(404).json({message:"Lecture not found"});
  await audit(req.user._id,"UPDATE_LECTURE","Lecture",lecture.title);
  res.json(lecture);
});
router.get("/lectures", async (req,res)=>res.json(await Lecture.find().populate("course","name").sort({date:1})));
router.post("/assignments", async (req,res)=>res.status(201).json(await Assignment.create(req.body)));
router.get("/assignments", async (req,res)=>res.json(await Assignment.find().populate("course","name").sort({createdAt:-1})));
router.post("/announcements", async (req,res)=>res.status(201).json(await Announcement.create(req.body)));
router.get("/announcements", async (req,res)=>res.json(await Announcement.find().sort({pinned:-1,createdAt:-1})));
router.get("/activity", async (req,res)=>res.json(await Activity.find().populate("actor","fullName").sort({createdAt:-1}).limit(100)));

// Attendance roster and bulk marking
router.get("/attendance", async (req, res) => {
  const { lectureId } = req.query;
  if (!lectureId) return res.status(400).json({ message: "Select a lecture first" });
  const lecture = await Lecture.findById(lectureId).populate("course", "name");
  if (!lecture) return res.status(404).json({ message: "Lecture not found" });
  const studentFilter = { role: "STUDENT", active: true, courses: lecture.course._id };
  if (lecture.batch) studentFilter.batch = lecture.batch;
  const [students, records] = await Promise.all([
    User.find(studentFilter).select("fullName userId batch"),
    Attendance.find({ lecture: lecture._id }),
  ]);
  const statusByStudent = new Map(records.map((record) => [String(record.student), record.status]));
  res.json({ lecture, students: students.map((student) => ({
    _id: student._id, fullName: student.fullName, userId: student.userId, batch: student.batch,
    status: statusByStudent.get(String(student._id)) || "ABSENT",
  })) });
});
router.post("/attendance/bulk", async (req, res) => {
  const { lectureId, records } = req.body || {};
  if (!lectureId || !Array.isArray(records) || records.length === 0)
    return res.status(400).json({ message: "Lecture and attendance records are required" });
  const lecture = await Lecture.findById(lectureId);
  if (!lecture) return res.status(404).json({ message: "Lecture not found" });
  const validStatuses = new Set(["PRESENT", "ABSENT", "LATE"]);
  const studentIds = records.map((item) => String(item.studentId || ""));
  if (studentIds.some((id) => !id) || records.some((item) => !validStatuses.has(item.status)))
    return res.status(400).json({ message: "Invalid attendance record" });
  const enrollmentFilter = { _id: { $in: studentIds }, role: "STUDENT", active: true, courses: lecture.course };
  if (lecture.batch) enrollmentFilter.batch = lecture.batch;
  const students = await User.find(enrollmentFilter);
  if (students.length !== new Set(studentIds).size)
    return res.status(400).json({ message: "One or more students are not enrolled in this lecture course" });
  await Promise.all(records.map((item) => Attendance.findOneAndUpdate(
    { lecture: lecture._id, student: item.studentId },
    { status: item.status },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )));
  await audit(req.user._id, "MARK_ATTENDANCE", "Lecture", lecture.title);
  res.json({ message: "Attendance saved", count: records.length });
});

// Assignment and quiz submissions: teacher review and marking
router.get("/submissions", async (req, res) => {
  const filter = req.query.assignmentId ? { assignment: req.query.assignmentId } : {};
  const submissions = await Submission.find(filter)
    .populate("student", "fullName userId batch")
    .populate("assignment", "title type course dueDate")
    .sort({ submittedAt: -1 });
  res.json(submissions);
});
router.patch("/submissions/:id", async (req, res) => {
  const marks = Number(req.body.marks);
  const feedback = String(req.body.feedback || "").slice(0, 3000);
  if (!Number.isFinite(marks) || marks < 0)
    return res.status(400).json({ message: "Marks must be a non-negative number" });
  const submission = await Submission.findById(req.params.id).populate("assignment", "title");
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  if (submission.maxMarks != null && marks > submission.maxMarks)
    return res.status(400).json({ message: `Marks cannot exceed ${submission.maxMarks}` });
  submission.marks = marks;
  submission.feedback = feedback;
  await submission.save();
  await audit(req.user._id, "GRADE_SUBMISSION", "Submission", submission.assignment?.title || submission._id);
  res.json({ message: "Submission graded", submission });
});

// Basic institute progress and reporting
router.get("/reports", async (req, res) => {
  const [students, activeStudents, courses, lectures, materials, assignments, submissions] = await Promise.all([
    User.countDocuments({ role: "STUDENT" }),
    User.countDocuments({ role: "STUDENT", active: true }),
    Course.find().select("name code"),
    Lecture.countDocuments(),
    Material.countDocuments(),
    Assignment.countDocuments(),
    Submission.countDocuments(),
  ]);
  const attendance = await Attendance.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  res.json({ students, activeStudents, courses, lectures, materials, assignments, submissions, attendance });
});

// Persist institute profile/settings
router.get("/certificates", async (req, res) => {
  const students = await User.find({ role: "STUDENT", active: true }).select("fullName userId courses completedLessons").populate("courses", "name code");
  const result = [];
  for (const student of students) {
    const completed = new Set((student.completedLessons || []).map((id) => String(id)));
    for (const course of student.courses) {
      const lessons = await Lesson.find({ course: course._id, status: "PUBLISHED" }).select("_id");
      if (lessons.length > 0 && lessons.every((lesson) => completed.has(String(lesson._id)))) {
        result.push({ studentId: student._id, studentName: student.fullName, userId: student.userId, courseId: course._id, courseName: course.name, courseCode: course.code });
      }
    }
  }
  res.json(result);
});
router.get("/settings", async (req, res) => {
  const settings = await InstituteSetting.findOne({ key: "main" });
  res.json(settings || { instituteName: "Lingo Institute", theme: "sage" });
});
router.put("/settings", async (req, res) => {
  const allowed = ["instituteName", "logoUrl", "contactEmail", "contactPhone", "address", "theme"];
  const update = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  if (update.instituteName !== undefined && !String(update.instituteName).trim())
    return res.status(400).json({ message: "Institute name is required" });
  const settings = await InstituteSetting.findOneAndUpdate(
    { key: "main" }, { $set: { ...update, updatedBy: req.user._id } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );
  await audit(req.user._id, "UPDATE_SETTINGS", "InstituteSetting", settings.instituteName);
  res.json(settings);
});
export default router;
