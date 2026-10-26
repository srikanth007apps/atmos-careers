import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand-mark";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-canopy-deep text-[#d6e3df]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo light />
          <p className="max-w-xs text-sm leading-relaxed text-[#b3cbc5]">
            {siteConfig.tagline}. We build residential communities across Bengaluru, and the people who build them with us.
          </p>
        </div>
        <div>
          <h2 className="mb-4 font-sans text-sm font-semibold text-white">Talk to HR</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2.5"><Mail className="mt-0.5 size-4 shrink-0" /><a className="hover:text-white" href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a></li>
            <li className="flex gap-2.5"><Phone className="mt-0.5 size-4 shrink-0" /><a className="hover:text-white" href={`tel:${siteConfig.contact.phone.replace(/\s/g, "")}`}>{siteConfig.contact.phone}</a></li>
            <li className="flex gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0" />{siteConfig.contact.address}</li>
          </ul>
        </div>
        <div>
          <h2 className="mb-4 font-sans text-sm font-semibold text-white">Around the site</h2>
          <ul className="space-y-3 text-sm">
            <li><Link className="hover:text-white" href="/careers">Open positions</Link></li>
            <li><Link className="hover:text-white" href="/contact">Contact</Link></li>
            <li><Link className="hover:text-white" href="/privacy">Privacy policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-[#8fa9a2] sm:px-6">
          © {new Date().getFullYear()} {siteConfig.companyName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
