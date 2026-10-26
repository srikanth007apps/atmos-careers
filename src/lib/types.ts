import type { AdminRole, ApplicationStatus, EmploymentType, JobStatus } from "./constants";

export interface Department {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Job {
  id: string;
  title: string;
  /** Sanitised HTML produced by the rich-text editor */
  description: string;
  departmentId: string;
  employmentType: EmploymentType | null;
  location: string | null;
  vacancies: number | null;
  /** Unix ms – last moment applications are accepted (end of day, APP_TIMEZONE) */
  applicationDeadline: number | null;
  status: JobStatus;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  lastUpdatedBy?: string;
  publishedAt: number | null;
  closedAt: number | null;
}

/** Public-safe projection stored at /publicJobIndexes/{jobId} */
export interface PublicJob {
  id: string;
  title: string;
  description: string;
  departmentId: string;
  departmentName: string;
  employmentType: EmploymentType | null;
  location: string | null;
  vacancies: number | null;
  applicationDeadline: number | null;
  publishedAt: number;
  updatedAt: number;
}

export interface Application {
  id: string;
  jobId: string;
  jobTitleSnapshot: string;
  departmentIdSnapshot: string;
  candidateName: string;
  phone: string;
  email: string;
  message: string;
  /** Cloudinary public_id (storage key) */
  resumePath: string;
  /** Cloudinary authenticated delivery URL – NOT publicly accessible without a signature */
  resumeUrl: string;
  resumeFileName: string;
  resumeContentType: string;
  resumeSize: number;
  resumeFormat: string;
  status: ApplicationStatus;
  appliedAt: number;
  updatedAt: number;
  recruiterNotes: string;
  reviewedBy: string | null;
  reviewedAt: number | null;
  consentAt: number;
  searchText: string;
}

export interface StatusHistoryEntry {
  id: string;
  previousStatus: ApplicationStatus | null;
  newStatus: ApplicationStatus;
  changedAt: number;
  changedBy: string;
  changedByName?: string;
  note: string;
  emailStatus?: "sent" | "failed" | "skipped";
}

export interface AdminUser {
  uid: string;
  username: string;
  usernameLower: string;
  displayName: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  passwordHash: string;
  sessionVersion: number;
  createdAt: number;
  lastLoginAt: number | null;
}

export type SafeAdmin = Omit<AdminUser, "passwordHash">;

export interface AppSettings {
  notifications: {
    sendAcknowledgement: boolean;
    sendStatusUpdates: boolean;
  };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
