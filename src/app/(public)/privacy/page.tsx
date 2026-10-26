import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-normal text-canopy">Candidate privacy policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Have this reviewed by your legal team before going live.</p>
        <div className="prose-job mt-10">
          <h2>What we collect</h2>
          <p>When you apply, we collect your name, phone number, email address, the message you write, your resume, and the date and time you applied.</p>
          <h2>How we use it</h2>
          <ul>
            <li>To assess your application for the role you applied to, and for similar roles at {siteConfig.companyName}.</li>
            <li>To contact you about your application, including interviews and outcomes.</li>
          </ul>
          <h2>Who can see it</h2>
          <p>Only authorised members of our HR and hiring teams. Your details and resume are never shown to other candidates or published.</p>
          <h2>How it is stored</h2>
          <p>Application data is kept in a secured database, and resumes in private file storage that can only be opened through short-lived, authorised links.</p>
          <h2>How long we keep it</h2>
          <p>We keep applications for up to 12 months after the role is filled, unless you ask us to delete them sooner.</p>
          <h2>Your choices</h2>
          <p>
            You can ask to see, correct or delete your data, or withdraw your application, by emailing{" "}
            <a href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a>.
          </p>
        </div>
      </main>
    </>
  );
}
