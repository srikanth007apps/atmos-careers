import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  const items = [
    { icon: Mail, label: "Email", value: siteConfig.contact.email, href: `mailto:${siteConfig.contact.email}` },
    { icon: Phone, label: "Phone", value: siteConfig.contact.phone, href: `tel:${siteConfig.contact.phone.replace(/\s/g, "")}` },
    { icon: MapPin, label: "Office", value: siteConfig.contact.address },
  ];
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-normal text-canopy">Contact our HR team</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Questions about a role or your application? Reach us here. Please apply through the job page so your resume reaches the right team.
        </p>
        <ul className="mt-10 divide-y border-y">
          {items.map(({ icon: Icon, label, value, href }) => (
            <li key={label} className="flex items-center gap-4 py-5">
              <Icon className="size-5 text-moss" aria-hidden />
              <span className="w-20 text-sm text-muted-foreground">{label}</span>
              {href ? <a href={href} className="font-semibold text-canopy hover:underline">{value}</a> : <span className="font-semibold">{value}</span>}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
