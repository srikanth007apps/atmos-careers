import Image from "next/image";
import logo from "../../public/brand/atmos-logo.png";
import logoLight from "../../public/brand/atmos-logo-light.png";
import mark from "../../public/brand/atmos-mark.png";
import markLight from "../../public/brand/atmos-mark-light.png";
import { cn } from "@/lib/utils";

/** The Atmos emblem on its own (used in the collapsed sidebar and small spaces). */
export function BrandMark({ light = false, className }: { light?: boolean; className?: string }) {
  return <Image src={light ? markLight : mark} alt="" aria-hidden priority className={cn("h-8 w-auto", className)} />;
}

/** Full Atmos Lifestyle logo, with an optional "Careers" label. Use `light` on dark backgrounds. */
export function Logo({ light = false, label = "Careers", className }: { light?: boolean; label?: string | null; className?: string }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Image src={light ? logoLight : logo} alt="Atmos Lifestyle" priority className="h-10 w-auto sm:h-12" />
      {label && (
        <span
          className={cn(
            "hidden border-l pl-3 text-sm font-semibold sm:inline",
            light ? "border-white/25 text-[#d3dfda]" : "border-border text-muted-foreground",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
