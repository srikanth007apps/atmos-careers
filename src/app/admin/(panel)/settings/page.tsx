import { PageHeader } from "@/components/admin/page-header";
import { ChangePasswordForm, NotificationSettings, RecalculateStats } from "@/components/admin/settings-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/server/auth";
import { isEmailConfigured } from "@/lib/server/email";
import { serverEnv } from "@/lib/server/env";
import { getSettings } from "@/lib/server/repos/settings";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const admin = await requireAdminPage();
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
            <CardDescription>
              Signed in as <strong>{admin.username}</strong> ({admin.email}). Last sign-in {formatDateTime(admin.lastLoginAt)}.
            </CardDescription>
          </CardHeader>
          <CardContent><ChangePasswordForm /></CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Email notifications</CardTitle></CardHeader>
            <CardContent><NotificationSettings initial={settings} emailConfigured={isEmailConfigured()} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Resume uploads</CardTitle>
              <CardDescription>Set on the server through environment variables.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="divide-y text-sm">
                <div className="flex justify-between py-2"><dt className="text-muted-foreground">Accepted formats</dt><dd className="font-semibold">{serverEnv.resume.allowWord ? "PDF, DOC, DOCX" : "PDF only"}</dd></div>
                <div className="flex justify-between py-2"><dt className="text-muted-foreground">Maximum size</dt><dd className="font-semibold">{Math.round(serverEnv.resume.maxBytes / 1048576)} MB</dd></div>
                <div className="flex justify-between py-2"><dt className="text-muted-foreground">Storage</dt><dd className="font-semibold">Cloudinary (private)</dd></div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Maintenance</CardTitle>
              <CardDescription>If dashboard counts ever look wrong, rebuild them from the stored applications.</CardDescription>
            </CardHeader>
            <CardContent><RecalculateStats /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Admin accounts</CardTitle>
              <CardDescription>
                New admins are created from the command line by whoever manages the server: <code className="text-xs">npm run admin:create</code>. There is no public sign-up.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </>
  );
}
