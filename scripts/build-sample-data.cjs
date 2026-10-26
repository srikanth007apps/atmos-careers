// Generates sample-data/atmos-sample-data.json (run: node scripts/build-sample-data.cjs)
const bcrypt = require("bcryptjs");
const fs = require("fs");
const D = 86400000;
const now = Date.parse("2026-10-19T12:00:00+05:30");
const eod = (s) => Date.parse(`${s}T23:59:59.999+05:30`);

const deptNames = {
  dept_sales: "Sales", dept_marketing: "Marketing", dept_digital: "Digital Marketing", dept_presales: "Presales",
  dept_crm: "Customer Relationship Management (CRM)", dept_construction: "Construction", dept_architecture: "Architecture",
  dept_engineering: "Engineering", dept_finance: "Finance and Accounts", dept_hr: "Human Resources",
  dept_legal: "Legal and Compliance", dept_it: "Information Technology", dept_support: "Customer Support",
};
const departments = Object.fromEntries(Object.entries(deptNames).map(([id, name]) => [id, { name, isActive: true, createdAt: now - 30 * D, updatedAt: now - 30 * D }]));

const html = (about, does, needs) =>
  `<h2>About the role</h2><p>${about}</p><h3>What you will do</h3><ul>${does.map((x) => `<li><p>${x}</p></li>`).join("")}</ul><h3>What we are looking for</h3><ul>${needs.map((x) => `<li><p>${x}</p></li>`).join("")}</ul><p>We offer a competitive salary, performance incentives and medical cover for your family.</p>`;

const jobDefs = [
  ["job_site_engineer", "Senior Site Engineer", "dept_construction", "full_time", "Whitefield, Bengaluru", 3, "2026-12-15", "published", 2,
    html("Lead site execution for our residential community in Whitefield, making sure every tower is built to plan, on schedule and safely.",
      ["Plan and supervise daily civil and finishing work with contractors", "Run quality checks on structure, waterproofing and MEP", "Report weekly progress to the project head"],
      ["B.E./B.Tech in Civil Engineering", "5+ years on residential high-rise projects", "Working knowledge of AutoCAD and MS Project"])],
  ["job_sales_manager", "Sales Manager – Villas", "dept_sales", "full_time", "Sarjapur Road, Bengaluru", 2, null, "published", 5,
    html("Own sales for our premium villa project and guide buyers from first visit to registration.",
      ["Conduct site visits and walkthroughs for walk-in and channel-partner leads", "Negotiate and close bookings against monthly targets", "Work with CRM on agreements and payment follow-ups"],
      ["4+ years selling residential real estate in Bengaluru", "Strong spoken English and Kannada or Hindi", "Comfortable with CRM tools"])],
  ["job_presales", "Presales Executive", "dept_presales", "full_time", "Bengaluru", 4, "2026-11-30", "published", 8,
    html("Be the first voice our prospective buyers hear: qualify leads and book site visits for the sales team.",
      ["Call and follow up on leads from digital campaigns and portals", "Qualify budget, location and timelines", "Schedule and confirm site visits"],
      ["1–3 years in presales or inside sales", "Clear, friendly phone manner", "Graduate in any discipline"])],
  ["job_landscape", "Landscape Architect", "dept_architecture", "contract", "Devanahalli", 1, null, "published", 12,
    html("Design green spaces that keep the native trees at the heart of each community.",
      ["Prepare landscape concepts and working drawings", "Select native plant species with the horticulture team", "Coordinate with civil teams during execution"],
      ["B.Arch / M.Arch with landscape specialisation", "Portfolio of residential or township projects"])],
  ["job_perf_intern", "Performance Marketing Intern", "dept_digital", "internship", "Bengaluru (Hybrid)", 2, "2026-11-10", "published", 1,
    html("Learn performance marketing on live real estate campaigns across Google and Meta.",
      ["Help set up and monitor lead-generation campaigns", "Prepare weekly reports on cost per lead", "Test ad creatives with the design team"],
      ["Final-year student or recent graduate", "Interest in digital marketing and analytics"])],
  ["job_crm_exec", "CRM Executive", "dept_crm", "full_time", "Bengaluru", 1, null, "draft", 0,
    html("Look after customers from booking to handover.", ["Manage payment schedules and demand letters", "Coordinate documentation and registration"], ["2+ years in real estate CRM"])],
  ["job_accounts", "Accounts Executive", "dept_finance", "full_time", "Bengaluru", 1, null, "closed", 40,
    html("Handle day-to-day accounting for project accounts.", ["Maintain ledgers and vendor payments", "Support GST and TDS filings"], ["B.Com / M.Com", "Tally experience"])],
];

const jobs = {}, publicJobIndexes = {};
for (const [id, title, dep, type, loc, vac, dl, status, ageDays, description] of jobDefs) {
  const created = now - ageDays * D;
  const job = {
    title, description, departmentId: dep, employmentType: type, location: loc, vacancies: vac,
    applicationDeadline: dl ? eod(dl) : null, status, isActive: status !== "closed",
    createdAt: created, updatedAt: created, createdBy: "admin_default",
    publishedAt: status === "draft" ? null : created, closedAt: status === "closed" ? now - 2 * D : null,
  };
  jobs[id] = job;
  if (status === "published") publicJobIndexes[id] = {
    id, title, description, departmentId: dep, departmentName: deptNames[dep], employmentType: type, location: loc,
    vacancies: vac, applicationDeadline: job.applicationDeadline, publishedAt: created, updatedAt: created,
  };
}

const people = [
  ["Ananya Rao", "9845012345", "job_site_engineer", "new", 0.2],
  ["Karthik Menon", "9900123456", "job_sales_manager", "new", 0.5],
  ["Priya Shetty", "9886234567", "job_presales", "under_review", 1],
  ["Rahul Gowda", "9741345678", "job_sales_manager", "shortlisted", 1.5],
  ["Sneha Iyer", "9632456789", "job_site_engineer", "interview_scheduled", 2],
  ["Vikram Reddy", "9538567890", "job_perf_intern", "new", 0.8],
  ["Divya Nair", "9480678901", "job_accounts", "rejected", 6],
  ["Arjun Kulkarni", "9019789012", "job_landscape", "selected", 9],
  ["Meera Pillai", "8971890123", "job_presales", "under_review", 3],
  ["Rohan Das", "8867901234", "job_sales_manager", "new", 0.1],
];
const applications = {}, applicationStatusHistory = {}, applicationKeys = {};
const byStatus = { new: 0, under_review: 0, shortlisted: 0, interview_scheduled: 0, selected: 0, rejected: 0, withdrawn: 0 }, byJob = {};
const crypto = require("crypto");
people.forEach(([name, phone, jobId, status, daysAgo], i) => {
  const id = `app_sample_${String(i + 1).padStart(2, "0")}`;
  const email = `${name.toLowerCase().replace(/ /g, ".")}@example.com`;
  const job = jobs[jobId];
  const appliedAt = Math.round(now - daysAgo * D);
  const pid = `atmos-careers/resumes/${jobId}/sample-${i + 1}.pdf`;
  applications[id] = {
    jobId, jobTitleSnapshot: job.title, departmentIdSnapshot: job.departmentId, candidateName: name, phone, email,
    message: `I have several years of relevant experience in Bengaluru real estate and I'm keen to join Atmos Lifestyle as ${job.title}. I'm available to join within 30 days.`,
    resumePath: pid, resumeUrl: `https://res.cloudinary.com/your-cloud/raw/authenticated/${pid}`,
    resumeFileName: `${name.split(" ")[0]}_Resume.pdf`, resumeContentType: "application/pdf", resumeSize: 180000 + i * 7300, resumeFormat: "pdf",
    status, appliedAt, updatedAt: appliedAt, recruiterNotes: status === "shortlisted" ? "Strong closer. Expected CTC 14 LPA, 30-day notice." : "",
    reviewedBy: status === "new" ? null : "admin_default", reviewedAt: status === "new" ? null : appliedAt + D / 4,
    consentAt: appliedAt, searchText: `${name} ${email} ${phone} ${job.title}`.toLowerCase(),
  };
  applicationStatusHistory[id] = { h1: { previousStatus: null, newStatus: "new", changedAt: appliedAt, changedBy: "candidate", note: "Application submitted" } };
  if (status !== "new") applicationStatusHistory[id].h2 = { previousStatus: "new", newStatus: status, changedAt: appliedAt + D / 4, changedBy: "admin_default", changedByName: "Atmos HR Admin", note: "Sample status change" };
  const key = crypto.createHash("sha256").update(email).digest("hex").slice(0, 40);
  (applicationKeys[jobId] ??= {})[key] = id;
  byStatus[status]++; byJob[jobId] = (byJob[jobId] ?? 0) + 1;
});

const adminUsers = {
  admin_default: {
    username: "admin", usernameLower: "admin", displayName: "Atmos HR Admin", email: "hr@example.com", role: "super_admin",
    isActive: true, passwordHash: bcrypt.hashSync("Atmos@2026Admin", 12), sessionVersion: 1, createdAt: now, lastLoginAt: null,
  },
};

const data = {
  departments, jobs, publicJobIndexes, applications, applicationStatusHistory, applicationKeys,
  stats: { applications: { total: people.length, byStatus, byJob } },
  settings: { notifications: { sendAcknowledgement: false, sendStatusUpdates: false } },
  adminUsers,
};
fs.writeFileSync("sample-data/atmos-sample-data.json", JSON.stringify(data, null, 2));
console.log("written", Object.keys(jobs).length, "jobs,", people.length, "applications");
