"use client";
import * as React from "react";
import { AlertDialog as AD } from "radix-ui";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

const AlertDialog = AD.Root;
const AlertDialogTrigger = AD.Trigger;

function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AD.Content>) {
  return (
    <AD.Portal>
      <AD.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <AD.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-card p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </AD.Portal>
  );
}
const AlertDialogHeader = ({ className, ...p }: React.ComponentProps<"div">) => <div className={cn("flex flex-col gap-2", className)} {...p} />;
const AlertDialogFooter = ({ className, ...p }: React.ComponentProps<"div">) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...p} />
);
const AlertDialogTitle = ({ className, ...p }: React.ComponentProps<typeof AD.Title>) => (
  <AD.Title className={cn("font-serif text-lg font-medium text-canopy", className)} {...p} />
);
const AlertDialogDescription = ({ className, ...p }: React.ComponentProps<typeof AD.Description>) => (
  <AD.Description className={cn("text-sm text-muted-foreground", className)} {...p} />
);
const AlertDialogCancel = ({ className, ...p }: React.ComponentProps<typeof AD.Cancel>) => (
  <AD.Cancel className={cn(buttonVariants({ variant: "outline" }), className)} {...p} />
);
const AlertDialogAction = ({ className, ...p }: React.ComponentProps<typeof AD.Action>) => (
  <AD.Action className={cn(buttonVariants(), className)} {...p} />
);
export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
};
