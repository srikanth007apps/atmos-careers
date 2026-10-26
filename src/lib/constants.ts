export const JOB_STATUSES = ["draft", "published", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  published: "Published",
  closed: "Closed",
};

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

export const APPLICATION_STATUSES = [
  "new",
  "under_review",
  "shortlisted",
  "interview_scheduled",
  "selected",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "New",
  under_review: "Under Review",
  shortlisted: "Shortlisted",
  interview_scheduled: "Interview Scheduled",
  selected: "Selected",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const ADMIN_ROLES = ["admin", "super_admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const SESSION_COOKIE = "atmos_admin_session";
export const SIDEBAR_COOKIE = "atmos_sidebar";

export const DEFAULT_DEPARTMENTS = [
  "Sales",
  "Marketing",
  "Digital Marketing",
  "Presales",
  "Customer Relationship Management (CRM)",
  "Construction",
  "Architecture",
  "Engineering",
  "Finance and Accounts",
  "Human Resources",
  "Legal and Compliance",
  "Information Technology",
  "Customer Support",
];

export const PAGE_SIZE = {
  publicJobs: 9,
  adminJobs: 15,
  applications: 20,
} as const;
