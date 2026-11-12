import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, Course, Lesson, Material, Lecture, Assignment, Announcement, Activity } from "../models/index.js";
import { audit } from "../utils/audit.js";
import { ensureDefaultCourses } from "../utils/ensureDefaultCourses.js";
const router = Router();
const studentInput = z.object({
  fullName: z.string().min(2), fatherName: z.string().optional(), phone: z.string().optional(),
  whatsapp: z.string().optional(), email: z.string().email().optional().or(z.literal("")),
  gender: z.string().optional(), dateOfBirth: z.string().optional(), address: z.string().optional(),
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
router.patch("/lectures/:id", async (req,res)=>res.json(await Lecture.findByIdAndUpdate(req.params.id,req.body,{new:true})));
router.get("/lectures", async (req,res)=>res.json(await Lecture.find().populate("course","name").sort({date:1})));
router.post("/assignments", async (req,res)=>res.status(201).json(await Assignment.create(req.body)));
router.get("/assignments", async (req,res)=>res.json(await Assignment.find().populate("course","name").sort({createdAt:-1})));
router.post("/announcements", async (req,res)=>res.status(201).json(await Announcement.create(req.body)));
router.get("/announcements", async (req,res)=>res.json(await Announcement.find().sort({pinned:-1,createdAt:-1})));
router.get("/activity", async (req,res)=>res.json(await Activity.find().populate("actor","fullName").sort({createdAt:-1}).limit(100)));
export default router;
