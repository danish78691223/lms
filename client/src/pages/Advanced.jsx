import React, { useEffect, useState } from "react";
import { api } from "../api";
import { Download, Save, Award, Video } from "lucide-react";

function Heading({ title, description }) {
  return <div className="mb-6"><h1 className="text-3xl font-bold">{title}</h1><p className="text-slate-500 mt-1">{description}</p></div>;
}
function ErrorText({ children }) { return children ? <p role="alert" className="text-sm text-red-600 mt-3">{children}</p> : null; }
function Empty({ children }) { return <div className="card p-8 text-center text-sm text-slate-500">{children}</div>; }

export function AdminAttendance() {
  const [lectures,setLectures]=useState([]),[lectureId,setLectureId]=useState(""),[students,setStudents]=useState([]),[error,setError]=useState(""),[message,setMessage]=useState(""),[loading,setLoading]=useState(false);
  useEffect(()=>{api("/admin/lectures").then(rows=>{setLectures(rows);if(rows[0])setLectureId(rows[0]._id)}).catch(e=>setError(e.message))},[]);
  useEffect(()=>{if(!lectureId){setStudents([]);return}setLoading(true);setError("");api("/admin/attendance?lectureId="+encodeURIComponent(lectureId)).then(x=>setStudents(x.students||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[lectureId]);
  function setStatus(id,status){setStudents(rows=>rows.map(s=>s._id===id?{...s,status}:s));setMessage("")}
  async function save(){setError("");setMessage("");try{const x=await api("/admin/attendance/bulk",{method:"POST",body:JSON.stringify({lectureId,records:students.map(s=>({studentId:s._id,status:s.status}))})});setMessage(x.message)}catch(e){setError(e.message)}}
  return <>
    <Heading title="Attendance" description="Choose a lecture, mark each enrolled student, and save the register."/>
    <section className="card p-5 mb-5"><label className="block text-sm font-medium">Select lecture<select className="field mt-2" value={lectureId} onChange={e=>setLectureId(e.target.value)}><option value="">Choose lecture</option>{lectures.map(l=><option key={l._id} value={l._id}>{l.title} · {l.course?.name||"Course"} · {new Date(l.date).toLocaleString()}</option>)}</select></label></section>
    {loading?<Empty>Loading attendance roster…</Empty>:!lectureId?<Empty>No lectures scheduled yet. Create a lecture first.</Empty>:students.length===0?<Empty>No active students are enrolled in this lecture's course and batch.</Empty>:<>
      <div className="card overflow-hidden"><div className="p-4 border-b font-bold">Student register ({students.length})</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{["Student","Student ID","Batch","Attendance"].map(x=><th className="p-3 text-left" key={x}>{x}</th>)}</tr></thead><tbody>{students.map(s=><tr className="border-t" key={s._id}><td className="p-3 font-medium">{s.fullName}</td><td className="p-3">{s.userId}</td><td className="p-3">{s.batch||"—"}</td><td className="p-3"><select className="field !w-36 !py-2" value={s.status} onChange={e=>setStatus(s._id,e.target.value)}><option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="LATE">Late</option></select></td></tr>)}</tbody></table></div></div>
      <div className="flex items-center gap-3 mt-4"><button className="btn" onClick={save}><Save size={16} className="inline mr-1"/>Save attendance</button>{message&&<span className="text-sm text-teal">{message}</span>}</div>
    </>}
    <ErrorText>{error}</ErrorText>
  </>;
}

export function AdminAssignments() {
  const [courses,setCourses]=useState([]),[assignments,setAssignments]=useState([]),[submissions,setSubmissions]=useState([]),[form,setForm]=useState({title:"",description:"",course:"",dueDate:"",type:"ASSIGNMENT"}),[questions,setQuestions]=useState([{prompt:"",kind:"MCQ",options:"Option A\nOption B",answer:""}]),[drafts,setDrafts]=useState({}),[error,setError]=useState(""),[message,setMessage]=useState("");
  async function load(){const result=await Promise.all([api("/admin/assignments"),api("/admin/submissions")]);setAssignments(result[0]);setSubmissions(result[1])}
  useEffect(()=>{api("/admin/courses").then(rows=>{setCourses(rows);setForm(p=>({...p,course:p.course||rows[0]?._id||""}))}).catch(e=>setError(e.message));load().catch(e=>setError(e.message))},[]);
  function updateQuestion(index,key,value){setQuestions(rows=>rows.map((q,i)=>i===index?{...q,[key]:value}:q))}
  async function create(e){e.preventDefault();setError("");setMessage("");try{
    const payload={...form,dueDate:form.dueDate?new Date(form.dueDate):null,status:"PUBLISHED",questions:["QUIZ","TEST"].includes(form.type)?questions.map(q=>({prompt:q.prompt,kind:q.kind,options:q.kind==="MCQ"?q.options.split("\n").map(v=>v.trim()).filter(Boolean):q.kind==="TRUE_FALSE"?["True","False"]:[],answer:q.answer})):[]};
    if(!payload.course)throw new Error("Create or select a course first.");
    if(["QUIZ","TEST"].includes(form.type)&&payload.questions.some(q=>!q.prompt.trim()||!q.answer.trim()))throw new Error("Add a prompt and correct answer for every question.");
    await api("/admin/assignments",{method:"POST",body:JSON.stringify(payload)});setForm(p=>({...p,title:"",description:"",dueDate:""}));setQuestions([{prompt:"",kind:"MCQ",options:"Option A\nOption B",answer:""}]);setMessage("Published successfully.");await load();
  }catch(e){setError(e.message)}}
  async function grade(id){const d=drafts[id]||{};setError("");setMessage("");try{await api("/admin/submissions/"+id,{method:"PATCH",body:JSON.stringify({marks:d.marks,feedback:d.feedback||""})});setMessage("Marks and feedback saved.");await load()}catch(e){setError(e.message)}}
  return <>
    <Heading title="Assignments, quizzes & tests" description="Publish work, build auto-graded quizzes, and review written submissions."/>
    <div className="grid xl:grid-cols-[440px_1fr] gap-5">
      <form className="card p-5 h-fit" onSubmit={create}><h2 className="font-bold text-lg mb-4">Create assessment</h2>
        <label className="block text-sm mb-3">Title<input className="field mt-1" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
        <label className="block text-sm mb-3">Description<textarea className="field mt-1" rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
        <label className="block text-sm mb-3">Course<select className="field mt-1" value={form.course} onChange={e=>setForm({...form,course:e.target.value})}>{courses.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
        <label className="block text-sm mb-3">Assessment type<select className="field mt-1" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="ASSIGNMENT">Written assignment</option><option value="QUIZ">Quiz (auto-graded)</option><option value="TEST">Test (auto-graded)</option></select></label>
        <label className="block text-sm mb-3">Due date (optional)<input className="field mt-1" type="datetime-local" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label>
        {["QUIZ","TEST"].includes(form.type)&&<div className="border-t pt-4 mt-4"><div className="flex justify-between mb-3"><b>Questions</b><button type="button" className="text-sm text-teal font-semibold" onClick={()=>setQuestions(q=>[...q,{prompt:"",kind:"MCQ",options:"Option A\nOption B",answer:""}])}>+ Add question</button></div>
          {questions.map((q,i)=><div key={i} className="rounded-xl bg-slate-50 p-3 mb-3"><p className="text-xs font-semibold text-slate-500 mb-2">QUESTION {i+1}</p><input className="field mb-2" placeholder="Question prompt" value={q.prompt} onChange={e=>updateQuestion(i,"prompt",e.target.value)}/><select className="field mb-2" value={q.kind} onChange={e=>updateQuestion(i,"kind",e.target.value)}><option value="MCQ">Multiple choice</option><option value="TRUE_FALSE">True / False</option><option value="FILL">Fill in the blank</option></select>{q.kind==="MCQ"&&<textarea className="field mb-2" rows="3" placeholder="One option per line" value={q.options} onChange={e=>updateQuestion(i,"options",e.target.value)}/ >}{q.kind==="TRUE_FALSE"&&<p className="text-xs text-slate-500 mb-2">Options: True and False</p>}<input className="field" placeholder="Correct answer" value={q.answer} onChange={e=>updateQuestion(i,"answer",e.target.value)}/>{questions.length>1&&<button type="button" className="text-xs text-red-600 mt-2" onClick={()=>setQuestions(qs=>qs.filter((_,j)=>j!==i))}>Remove question</button>}</div>)}
        </div>}
        <button className="btn w-full mt-2">Publish assessment</button><ErrorText>{error}</ErrorText>{message&&<p className="text-sm text-teal mt-3">{message}</p>}
      </form>
      <div className="space-y-5">
        <section className="card p-5"><h2 className="font-bold mb-3">Published assessments ({assignments.length})</h2>{assignments.length?assignments.map(a=><div className="py-3 border-b last:border-0" key={a._id}><div className="flex justify-between gap-3"><b>{a.title}</b><span className="text-xs rounded-full bg-sage px-2 py-1">{a.type}</span></div><p className="text-xs text-slate-500 mt-1">{a.course?.name} · {a.dueDate?new Date(a.dueDate).toLocaleString():"No due date"}</p></div>):<p className="text-sm text-slate-500">No assessments published.</p>}</section>
        <section className="card p-5"><h2 className="font-bold mb-3">Student submissions ({submissions.length})</h2>{submissions.length?submissions.map(s=><div className="border-t py-4" key={s._id}><div className="flex justify-between gap-3"><div><b>{s.student?.fullName||"Student"}</b><p className="text-xs text-slate-500">{s.student?.userId} · {s.assignment?.title} · {s.assignment?.type}</p></div><span className="text-xs text-slate-500">{s.submittedAt?new Date(s.submittedAt).toLocaleDateString():""}</span></div><p className="text-sm whitespace-pre-wrap bg-slate-50 rounded-lg p-3 mt-3 break-words">{s.answerText?.startsWith("{")?"Quiz response recorded and auto-graded.":(s.answerText||"No text response")}</p>{s.fileUrl&&<a className="text-sm text-teal" href={s.fileUrl} target="_blank" rel="noreferrer">Open submitted file ↗</a>}<div className="grid sm:grid-cols-[110px_1fr_auto] gap-2 mt-3"><input className="field" type="number" min="0" placeholder="Marks" value={drafts[s._id]?.marks??s.marks??""} onChange={e=>setDrafts(p=>({...p,[s._id]:{...p[s._id],marks:e.target.value}}))}/><input className="field" placeholder="Teacher feedback" value={drafts[s._id]?.feedback??s.feedback??""} onChange={e=>setDrafts(p=>({...p,[s._id]:{...p[s._id],feedback:e.target.value}}))}/><button className="btn" onClick={()=>grade(s._id)}>Save grade</button></div>{s.marks!=null&&<p className="text-xs text-teal mt-2">Current grade: {s.marks}{s.maxMarks!=null?" / "+s.maxMarks:""}</p>}</div>):<p className="text-sm text-slate-500">No submissions received yet.</p>}</section>
      </div>
    </div>
  </>;
}

export function StudentAssignments() {
  const [items,setItems]=useState([]),[answers,setAnswers]=useState({}),[written,setWritten]=useState({}),[busy,setBusy]=useState({}),[error,setError]=useState("");
  async function load(){try{setItems(await api("/student/assignments"))}catch(e){setError(e.message)}}
  useEffect(()=>{load()},[]);
  async function submit(item){setError("");setBusy(p=>({...p,[item._id]:true}));try{const quiz=["QUIZ","TEST"].includes(item.type);await api("/student/assignments/"+item._id+"/submit",{method:"POST",body:JSON.stringify(quiz?{answers:item.questions.map((_,i)=>answers[item._id+":"+i]||"")}:{answerText:written[item._id]||""})});await load()}catch(e){setError(e.message)}finally{setBusy(p=>({...p,[item._id]:false}))}}
  return <><Heading title="Assignments & quizzes" description="Complete written assignments and take your published quizzes and tests."/><ErrorText>{error}</ErrorText>
    {items.length?items.map(item=>{const quiz=["QUIZ","TEST"].includes(item.type),submitted=item.submission;return <section className="card p-5 mb-4" key={item._id}><div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-bold text-lg">{item.title}</h2><p className="text-xs text-slate-500 mt-1">{item.course?.name} · {item.type} · {item.dueDate?"Due "+new Date(item.dueDate).toLocaleString():"No due date"}</p></div><span className="bg-sage text-teal text-xs rounded-full px-3 py-1 h-fit">{submitted?"Submitted":"Pending"}</span></div><p className="text-sm text-slate-600 mt-3">{item.description}</p>
      {quiz&&!submitted&&<div className="mt-4 space-y-4">{(item.questions||[]).map((q,i)=><label className="block text-sm" key={i}><b>{i+1}. {q.prompt}</b>{q.kind==="MCQ"||q.kind==="TRUE_FALSE"?<select className="field mt-2" value={answers[item._id+":"+i]||""} onChange={e=>setAnswers(p=>({...p,[item._id+":"+i]:e.target.value}))}><option value="">Choose answer</option>{(q.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>:<input className="field mt-2" value={answers[item._id+":"+i]||""} onChange={e=>setAnswers(p=>({...p,[item._id+":"+i]:e.target.value}))} placeholder="Your answer"/>}</label>)}</div>}
      {!quiz&&!submitted&&<textarea className="field mt-4" rows="4" placeholder="Write your answer here…" value={written[item._id]||""} onChange={e=>setWritten(p=>({...p,[item._id]:e.target.value}))}/>}
      {submitted&&<div className="bg-sage/60 rounded-xl p-4 mt-4"><b className="text-sm">{submitted.marks!=null?"Result: "+submitted.marks+(submitted.maxMarks!=null?" / "+submitted.maxMarks:""):"Submission received"}</b><p className="text-sm text-slate-600 mt-1">{submitted.feedback||"Your teacher will review this submission."}</p></div>}
      {!submitted&&<button className="btn mt-4" disabled={!!busy[item._id]} onClick={()=>submit(item)}>{busy[item._id]?"Submitting…":quiz?"Submit answers":"Submit assignment"}</button>}
    </section>}) : <Empty>No assignments or quizzes published for your courses yet.</Empty>}
  </>;
}

export function StudentProgress() {
  const [data,setData]=useState(null),[error,setError]=useState("");
  useEffect(()=>{api("/student/progress").then(setData).catch(e=>setError(e.message))},[]);
  return <><Heading title="My progress" description="Track lesson completion, assessment results and attendance."/><ErrorText>{error}</ErrorText>
    {!data?<Empty>Loading progress…</Empty>:<><div className="grid sm:grid-cols-3 gap-4 mb-5"><div className="card p-5"><p className="text-sm text-slate-500">Assessments submitted</p><p className="text-3xl font-bold mt-2">{data.submissions}</p></div><div className="card p-5"><p className="text-sm text-slate-500">Graded assessments</p><p className="text-3xl font-bold mt-2">{data.graded}</p></div><div className="card p-5"><p className="text-sm text-slate-500">Present attendance</p><p className="text-3xl font-bold mt-2">{data.attendancePresent} / {data.attendance}</p></div></div>
      <div className="space-y-4">{data.courses.map(c=><div className="card p-5" key={c.courseId}><div className="flex justify-between gap-3"><h2 className="font-bold text-lg">{c.name}</h2><b className="text-teal">{c.percent}%</b></div><div className="h-2 bg-slate-100 rounded-full mt-4"><div className="h-2 bg-teal rounded-full" style={{width:c.percent+"%"}}/></div><p className="text-xs text-slate-500 mt-2">{c.completedLessons} of {c.totalLessons} published lessons completed · {c.publishedMonths} of 8 months published</p></div>)}</div>
    </>}
  </>;
}

export function AdminReports() {
  const [data,setData]=useState(null),[error,setError]=useState("");
  useEffect(()=>{api("/admin/reports").then(setData).catch(e=>setError(e.message))},[]);
  function exportCsv(){if(!data)return;const rows=[["Metric","Value"],["Total students",data.students],["Active students",data.activeStudents],["Lectures",data.lectures],["Materials",data.materials],["Assessments",data.assignments],["Submissions",data.submissions],...data.attendance.map(x=>["Attendance "+x._id.toLowerCase(),x.count])];const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="lms-report.csv";a.click();URL.revokeObjectURL(url)}
  return <><Heading title="Reports" description="Institute-wide enrolment, learning activity and attendance summary."/><ErrorText>{error}</ErrorText>{!data?<Empty>Loading report…</Empty>:<><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{[["Students",data.students],["Active students",data.activeStudents],["Lectures",data.lectures],["Study materials",data.materials],["Assessments",data.assignments],["Submissions",data.submissions]].map(([label,value])=><div className="card p-5" key={label}><p className="text-sm text-slate-500">{label}</p><p className="text-3xl font-bold mt-2">{value}</p></div>)}</div><div className="card p-5 mt-5"><div className="flex justify-between items-center gap-3"><h2 className="font-bold">Attendance summary</h2><button className="btn" onClick={exportCsv}><Download size={16} className="inline mr-1"/>Export CSV</button></div>{data.attendance.length?data.attendance.map(x=><p className="mt-3 text-sm" key={x._id}>{x._id}: <b>{x.count}</b></p>):<p className="text-sm text-slate-500 mt-3">No attendance has been marked yet.</p>}</div></>}</>;
}

export function AdminSettings() {
  const [form,setForm]=useState({instituteName:"Lingo Institute",logoUrl:"",contactEmail:"",contactPhone:"",address:"",theme:"sage"}),[error,setError]=useState(""),[message,setMessage]=useState("");
  useEffect(()=>{api("/admin/settings").then(s=>setForm(p=>({...p,...s}))).catch(e=>setError(e.message))},[]);
  async function save(e){e.preventDefault();setError("");setMessage("");try{const s=await api("/admin/settings",{method:"PUT",body:JSON.stringify(form)});setForm(p=>({...p,...s}));setMessage("Institute settings saved.")}catch(e){setError(e.message)}}
  return <><Heading title="Institute settings" description="Update the institute identity and contact details."/><form className="card p-6 max-w-2xl" onSubmit={save}>{[["instituteName","Institute name"],["logoUrl","Logo URL"],["contactEmail","Contact email"],["contactPhone","Contact phone"],["address","Address"]].map(([key,label])=><label className="block text-sm mb-4" key={key}>{label}<input className="field mt-1" value={form[key]||""} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<label className="block text-sm mb-4">Theme<select className="field mt-1" value={form.theme} onChange={e=>setForm({...form,theme:e.target.value})}><option value="sage">Sage green</option><option value="teal">Teal</option></select></label><button className="btn"><Save size={16} className="inline mr-1"/>Save settings</button><ErrorText>{error}</ErrorText>{message&&<p className="text-sm text-teal mt-3">{message}</p>}</form></>;
}

export function AdminActivity() {
  const [items,setItems]=useState([]),[error,setError]=useState("");
  useEffect(()=>{api("/admin/activity").then(setItems).catch(e=>setError(e.message))},[]);
  return <><Heading title="Activity log" description="Recent administrative actions recorded by the system."/><ErrorText>{error}</ErrorText>{items.length?<div className="card p-5">{items.map(x=><div className="py-3 border-b last:border-0" key={x._id}><div className="flex justify-between gap-3"><b className="text-sm">{x.action}</b><span className="text-xs text-slate-500">{new Date(x.createdAt).toLocaleString()}</span></div><p className="text-sm text-slate-600 mt-1">{x.actor?.fullName||"System"} · {x.target} · {x.details}</p></div>)}</div>:<Empty>No activity has been recorded yet.</Empty>}</>;
}

function printCertificate(studentName,courseName){
  const w=window.open("","_blank","width=1000,height=720");if(!w)return;
  w.document.write("<!doctype html><html><head><title>Certificate</title><style>body{font-family:Georgia,serif;padding:38px;color:#263b38}.certificate{height:650px;border:12px double #4f9f94;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:35px}.label{letter-spacing:5px;color:#4f9f94}.name{font-size:42px;margin:22px}.course{font-size:30px;color:#356f68}p{font-size:18px}</style></head><body><div class='certificate'><div class='label'>CERTIFICATE OF COMPLETION</div><h1>Language Institute</h1><p>This certificate is proudly presented to</p><div class='name'>"+String(studentName).replace(/[&<>"]/g,"")+"</div><p>for successfully completing the course</p><div class='course'>"+String(courseName).replace(/[&<>"]/g,"")+"</div><p>Issued on "+new Date().toLocaleDateString()+"</p></div><script>window.onload=()=>window.print()</script></body></html>");w.document.close();
}
export function AdminCertificates() {
  const [rows,setRows]=useState([]),[error,setError]=useState("");
  useEffect(()=>{api("/admin/certificates").then(setRows).catch(e=>setError(e.message))},[]);
  return <><Heading title="Certificates" description="Generate printable certificates for students who completed every published lesson."/><ErrorText>{error}</ErrorText>{rows.length?<div className="card p-5">{rows.map(r=><div className="py-3 border-b last:border-0 flex flex-wrap items-center justify-between gap-3" key={r.studentId+r.courseId}><div><b>{r.studentName}</b><p className="text-sm text-slate-500">{r.userId} · {r.courseName}</p></div><button className="btn" onClick={()=>printCertificate(r.studentName,r.courseName)}><Award size={16} className="inline mr-1"/>Print certificate</button></div>)}</div>:<Empty>No students eligible yet. Students must complete all published lessons.</Empty>}</>;
}
export function StudentCertificates() {
  const [rows,setRows]=useState([]),[error,setError]=useState("");
  useEffect(()=>{api("/student/certificates").then(setRows).catch(e=>setError(e.message))},[]);
  return <><Heading title="My certificates" description="Available after completing every published lesson in an enrolled course."/><ErrorText>{error}</ErrorText>{rows.length?<div className="grid md:grid-cols-2 gap-4">{rows.map(r=><div className="card p-5" key={r.courseId}><Award className="text-teal mb-3"/><b>{r.courseName}</b><p className="text-sm text-slate-500 mt-1">Course completion</p><button className="btn mt-4" onClick={()=>printCertificate(r.studentName,r.courseName)}>Download / print certificate</button></div>)}</div>:<Empty>No certificates available yet. Keep completing your published lessons.</Empty>}</>;
}
export function StudentRecordings() {
  const [items,setItems]=useState([]),[error,setError]=useState("");
  useEffect(()=>{api("/student/recordings").then(setItems).catch(e=>setError(e.message))},[]);
  return <><Heading title="Recorded classes" description="Revisit recorded lessons from your enrolled courses."/><ErrorText>{error}</ErrorText>{items.length?<div className="grid md:grid-cols-2 gap-4">{items.map(x=><div className="card p-5" key={x._id}><Video className="text-teal mb-3"/><b>{x.title}</b><p className="text-xs text-slate-500 mt-1">{x.course?.name} · {new Date(x.date).toLocaleDateString()}</p>{x.recordingUrl?<a className="btn inline-block mt-4" href={x.recordingUrl} target="_blank" rel="noreferrer">Watch recording ↗</a>:<p className="text-sm text-slate-500 mt-3">Recording not uploaded yet.</p>}</div>)}</div>:<Empty>No recorded classes published for your courses.</Empty>}</>;
}
