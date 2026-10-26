import Link from "next/link";
import { Download, Eye } from "lucide-react";
import { ApplicationStatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApplicationListItem } from "@/lib/server/repos/applications";
import { formatDate, formatDateTime } from "@/lib/utils";

/** Server-rendered table; on small screens rows collapse into stacked cards. */
export function ApplicationsTable({
  items,
  departments,
  compact = false,
}: {
  items: ApplicationListItem[];
  departments: Record<string, string>;
  compact?: boolean;
}) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              {!compact && <TableHead>Phone</TableHead>}
              {!compact && <TableHead>Email</TableHead>}
              <TableHead>Job</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-semibold">
                  <Link href={`/admin/applications/${a.id}`} className="hover:underline">{a.candidateName}</Link>
                  {compact && <p className="text-xs font-normal text-muted-foreground">{a.email}</p>}
                </TableCell>
                {!compact && <TableCell className="whitespace-nowrap">{a.phone}</TableCell>}
                {!compact && <TableCell className="max-w-[200px] truncate">{a.email}</TableCell>}
                <TableCell className="max-w-[220px] truncate">{a.jobTitleSnapshot}</TableCell>
                <TableCell className="max-w-[160px] truncate">{departments[a.departmentIdSnapshot] ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap" title={formatDateTime(a.appliedAt)}>{formatDate(a.appliedAt)}</TableCell>
                <TableCell><ApplicationStatusBadge status={a.status} /></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {!compact && (
                      <Button asChild variant="ghost" size="icon" title={`Download resume (${a.resumeFileName})`}>
                        <a href={`/api/admin/applications/${a.id}/resume`} aria-label={`Download resume for ${a.candidateName}`}><Download /></a>
                      </Button>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/applications/${a.id}`}><Eye /> View</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden">
        {items.map((a) => (
          <li key={a.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admin/applications/${a.id}`} className="font-semibold hover:underline">{a.candidateName}</Link>
                <p className="truncate text-sm text-muted-foreground">{a.jobTitleSnapshot}</p>
              </div>
              <ApplicationStatusBadge status={a.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {departments[a.departmentIdSnapshot] ?? "—"}, applied {formatDate(a.appliedAt)}
            </p>
            {!compact && <p className="text-xs text-muted-foreground">{a.phone} | {a.email}</p>}
            <div className="flex gap-2 pt-1">
              <Button asChild variant="outline" size="sm"><Link href={`/admin/applications/${a.id}`}>View</Link></Button>
              {!compact && (
                <Button asChild variant="ghost" size="sm"><a href={`/api/admin/applications/${a.id}/resume`}><Download /> Resume</a></Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
