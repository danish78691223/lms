# Language Institute LMS

A MERN starter application for an institute teaching English, Arabic and Urdu. It includes a React/Vite portal, Express API, MongoDB models, JWT httpOnly-cookie authentication, role-based access, admin-created students, 8-month courses, syllabus/material publishing, lecture scheduling, attendance, assignments, announcements and student progress.

## Requirements
- Node.js 20+
- MongoDB 6+ (local or Atlas)

## Setup
1. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI` and a long random `JWT_SECRET`.
2. Install dependencies from the project root: `npm install`
3. Seed demo data: `npm run seed`
4. Start both apps: `npm run dev`
5. Open http://localhost:5173

The API runs on http://localhost:5000.

## Demo credentials
- Admin: `admin` / `Admin@12345`
- Students (created by seed): `LMS-ENG-2026-001` / `Student@12345`
- `LMS-ARA-2026-002` / `Student@12345`
- `LMS-URD-2026-003` / `Student@12345`

Change demo passwords immediately. Seed is intended for development only.

## Environment
See `server/.env.example`. Set `CLIENT_ORIGIN` to the deployed frontend origin in production and serve over HTTPS. Set `COOKIE_SECURE=true` behind HTTPS.

## Implemented modules
- Login, logout, current-user session, password change, forced first-login password update.
- Admin dashboard and student management (create/list/activate/deactivate/delete/reset password).
- Admin course/month syllabus creation and publishing.
- Study material records with publication and audience targeting.
- Lecture scheduling, announcements, assignments, attendance.
- Student dashboard, enrolled courses, published syllabus/materials, lectures, announcements, assignment submission and lesson completion.
- UI language selector and RTL layout direction for Urdu/Arabic.
- Seeded English, Arabic and Urdu courses with eight months each and three sample students.

## Production hardening checklist
This is a runnable foundation, not a security-audited hosted service. Before real student data:
- Use a managed MongoDB deployment with automated backups and least-privilege credentials.
- Configure HTTPS, secure cookies, strong JWT secret rotation, CORS allow-list and reverse-proxy settings.
- Add an email/SMS password reset workflow (the UI intentionally directs students to contact admin).
- Add Cloudinary/S3 signed upload/download integration; current material records accept secure external URLs and metadata only.
- Add malware scanning, MIME/size validation and private object storage before enabling file uploads.
- Add audit-log retention, monitoring, rate-limit tuning, CSRF strategy appropriate to deployment, and security testing.
- Configure a real calendar provider for Google Calendar insertion; current portal provides a calendar link.
- Configure PDF generation with embedded Noto/Amiri/Nastaliq fonts for Arabic/Urdu. Browser PDF printing can be used as a temporary fallback.
- Add a production rich-text editor and drag/drop ordering if required.

## Folder structure
```
server/
  src/{config,models,middleware,routes,utils}/
  seed.js
client/
  src/{components,pages,context}/
```
