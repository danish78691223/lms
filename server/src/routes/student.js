import { Router } from "express";
import { User, Course, Lesson, Material, Lecture, Assignment, Submission, Attendance, Announcement, PersonalNote } from "../models/index.js";
const router=Router();
router.get("/dashboard",async(req,res)=>{
 const student=await User.findById(req.user._id).populate("courses","name code months");
 const [lectures,announcements,assignments]=await Promise.all([
  Lecture.find({course:{$in:student.courses.map(c=>c._id)},date:{$gte:new Date()},status:{$ne:"CANCELLED"},$or:[{batch:{$exists:false}},{batch:null},{batch:""},{batch:student.batch}]}).populate("course","name").sort({date:1}).limit(6),
  Announcement.find({status:"PUBLISHED",$and:[{$or:[{courses:{$size:0}},{courses:{$exists:false}},{courses:{$in:student.courses.map(c=>c._id)}}]},{$or:[{batches:{$size:0}},{batches:{$exists:false}},{batches:student.batch}]}]}).sort({pinned:-1,createdAt:-1}).limit(5),
  Assignment.find({status:"PUBLISHED",course:{$in:student.courses.map(c=>c._id)}}).sort({dueDate:1}).limit(6)
 ]);
 const publishedLessons=await Lesson.find({course:{$in:student.courses.map(c=>c._id)},status:"PUBLISHED"}).select("course monthId");
 const completedIds=new Set((student.completedLessons||[]).map(id=>String(id)));
 const courseProgress=student.courses.map(course=>{
   const publishedMonths=course.months.filter(month=>month.status==="PUBLISHED");
   const completedMonths=publishedMonths.filter(month=>{
     const monthLessons=publishedLessons.filter(lesson=>String(lesson.course)===String(course._id)&&String(lesson.monthId)===String(month._id));
     return monthLessons.length>0&&monthLessons.every(lesson=>completedIds.has(String(lesson._id)));
   }).length;
   return {id:course._id,name:course.name,months:8,completedMonths,progressPercent:Math.round(completedMonths/8*100)};
 });
 res.json({student,courses:courseProgress,lectures,announcements,assignments});
});
router.get("/courses",async(req,res)=>res.json(await Course.find({_id:{$in:req.user.courses}}).select("name code description months")));
router.get("/syllabus",async(req,res)=>{
 const courses=await Course.find({_id:{$in:req.user.courses}});
 const lessons=await Lesson.find({course:{$in:courses.map(c=>c._id)},status:"PUBLISHED"}).populate("course","name");
 res.json({courses:courses.map(c=>({...c.toObject(),months:c.months.filter(m=>m.status==="PUBLISHED")})),lessons,completedLessonIds:req.user.completedLessons||[]});
});
router.get("/materials",async(req,res)=>{
 const courses=req.user.courses;
 const filter={course:{$in:courses},status:"PUBLISHED",$or:[{batches:{$size:0}},{batches:{$exists:false}},{batches:req.user.batch},{studentIds:req.user._id}]};
 res.json(await Material.find(filter).populate("course","name").sort({createdAt:-1}));
});
router.get("/lectures",async(req,res)=>res.json(await Lecture.find({course:{$in:req.user.courses},$or:[{batch:{$exists:false}},{batch:null},{batch:""},{batch:req.user.batch}]}).populate("course","name").sort({date:1})));
router.get("/announcements",async(req,res)=>res.json(await Announcement.find({status:"PUBLISHED",$and:[{$or:[{courses:{$size:0}},{courses:{$exists:false}},{courses:{$in:req.user.courses}}]},{$or:[{batches:{$size:0}},{batches:{$exists:false}},{batches:req.user.batch}]}]}).sort({pinned:-1,createdAt:-1})));
router.get("/assignments",async(req,res)=>{
 const assignments=await Assignment.find({status:"PUBLISHED",course:{$in:req.user.courses}}).populate("course","name");
 const submissions=await Submission.find({student:req.user._id});
 res.json(assignments.map(a=>{
   const item=a.toObject();
   // Never send answer keys to the browser.
   item.questions=(item.questions||[]).map(q=>({prompt:q.prompt,options:q.options,kind:q.kind}));
   item.submission=submissions.find(s=>String(s.assignment)===String(a._id))||null;
   return item;
 }));
});
router.post("/assignments/:id/submit",async(req,res)=>{
 const assignment=await Assignment.findOne({_id:req.params.id,status:"PUBLISHED",course:{$in:req.user.courses}});
 if(!assignment)return res.status(404).json({message:"Assignment unavailable"});
 let answerText=String(req.body.answerText||"");
 let marks=null, maxMarks=null, feedback="";
 if (["QUIZ","TEST"].includes(assignment.type)) {
   if (!Array.isArray(req.body.answers)) return res.status(400).json({message:"Submit quiz answers"});
   const questions=assignment.questions||[];
   if (!questions.length) return res.status(400).json({message:"This quiz has no questions yet"});
   const answers=req.body.answers;
   let correct=0;
   questions.forEach((question,index)=>{
     const submitted=String(answers[index]??"").trim().toLocaleLowerCase();
     const expected=String(question.answer??"").trim().toLocaleLowerCase();
     if(submitted && submitted===expected) correct++;
   });
   maxMarks=questions.length;
   marks=correct;
   feedback=`Auto-graded: ${correct} out of ${questions.length} correct (${Math.round(correct/questions.length*100)}%).`;
   answerText=JSON.stringify({answers});
 }
 const submission=await Submission.findOneAndUpdate(
   {assignment:assignment._id,student:req.user._id},
   {answerText,fileUrl:req.body.fileUrl,submittedAt:new Date(),...(marks!==null?{marks,maxMarks,feedback}:{})},
   {upsert:true,new:true,setDefaultsOnInsert:true}
 );
 res.json(submission);
});
router.post("/lessons/:id/complete",async(req,res)=>{
 const lesson=await Lesson.findOne({_id:req.params.id,status:"PUBLISHED",course:{$in:req.user.courses}});
 if(!lesson)return res.status(404).json({message:"Lesson unavailable"});
 await User.updateOne({_id:req.user._id},{$addToSet:{completedLessons:lesson._id}});
 res.json({message:"Lesson marked complete"});
});
router.get("/attendance",async(req,res)=>res.json(await Attendance.find({student:req.user._id}).populate({path:"lecture",populate:{path:"course",select:"name"}}).sort({createdAt:-1})));
router.get("/progress",async(req,res)=>{
 const student=await User.findById(req.user._id).select("courses completedLessons");
 const [courses,lessons,submissions,attendance]=await Promise.all([
   Course.find({_id:{$in:student.courses}}).select("name code months"),
   Lesson.find({course:{$in:student.courses},status:"PUBLISHED"}).select("course monthId title"),
   Submission.find({student:req.user._id}).populate("assignment","title type"),
   Attendance.find({student:req.user._id}),
 ]);
 const completed=new Set((student.completedLessons||[]).map(id=>String(id)));
 const perCourse=courses.map(course=>{
   const courseLessons=lessons.filter(l=>String(l.course)===String(course._id));
   const done=courseLessons.filter(l=>completed.has(String(l._id))).length;
   const completedMonthNumbers=course.months.filter(month=>{const monthLessons=courseLessons.filter(l=>String(l.monthId)===String(month._id));return month.status==="PUBLISHED"&&monthLessons.length>0&&monthLessons.every(l=>completed.has(String(l._id)))}).map(month=>month.number);
   const publishedMonthNumbers=course.months.filter(month=>month.status==="PUBLISHED").map(month=>month.number);
   return {courseId:course._id,name:course.name,totalLessons:courseLessons.length,completedLessons:done,percent:courseLessons.length?Math.round(done/courseLessons.length*100):0,totalMonths:8,publishedMonths:publishedMonthNumbers.length,completedMonthNumbers,publishedMonthNumbers};
 });
 res.json({courses:perCourse,submissions:submissions.length,graded:submissions.filter(s=>s.marks!=null).length,attendance:attendance.length,attendancePresent:attendance.filter(a=>a.status==="PRESENT").length});
});
router.get("/recordings",async(req,res)=>res.json(await Lecture.find({
 course:{$in:req.user.courses},
 status:{$ne:"CANCELLED"},
 $and:[
  {$or:[{batch:{$exists:false}},{batch:null},{batch:""},{batch:req.user.batch}]},
  {$or:[{mode:"RECORDED"},{recordingUrl:{$exists:true,$ne:""}}]}
 ]
}).populate("course","name").sort({date:-1})));
router.get("/certificates",async(req,res)=>{
 const student=await User.findById(req.user._id).select("courses completedLessons fullName userId");
 const completed=new Set((student.completedLessons||[]).map(id=>String(id)));
 const courses=await Course.find({_id:{$in:student.courses}}).select("name code");
 const certificates=[];
 for(const course of courses){
   const lessons=await Lesson.find({course:course._id,status:"PUBLISHED"}).select("_id");
   if(lessons.length>0 && lessons.every(lesson=>completed.has(String(lesson._id)))){
     certificates.push({courseId:course._id,courseName:course.name,courseCode:course.code,studentName:student.fullName});
   }
 }
 res.json(certificates);
});
router.get("/notes",async(req,res)=>{
 const notes=await PersonalNote.find({student:req.user._id}).select("lesson body updatedAt");
 res.json(notes);
});
router.put("/lessons/:id/note",async(req,res)=>{
 const lesson=await Lesson.findOne({_id:req.params.id,course:{$in:req.user.courses},status:"PUBLISHED"});
 if(!lesson)return res.status(404).json({message:"Lesson unavailable"});
 const body=String(req.body.body||"").slice(0,10000);
 const note=await PersonalNote.findOneAndUpdate(
  {student:req.user._id,lesson:lesson._id},
  {body},
  {upsert:true,new:true,setDefaultsOnInsert:true}
 );
 res.json(note);
});
router.get("/profile",async(req,res)=>res.json(await User.findById(req.user._id).select("-passwordHash").populate("courses","name")));
export default router;
