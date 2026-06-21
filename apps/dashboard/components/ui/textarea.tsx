import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
