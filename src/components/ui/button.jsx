'use client';

import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

// Button variants styled with integrated-tool-frontend's primary #208661 brand palette
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208661] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer active:scale-[0.98] transition-all duration-150",
  {
    variants: {
      variant: {
        default:
          "bg-[#208661] text-white font-semibold hover:bg-[#1a6d4f] shadow-sm shadow-[#208661]/20 border border-[#63ab91]/30",
        gradient:
          "bg-gradient-to-r from-[#208661] to-[#417ec9] text-white font-semibold hover:from-[#1a6d4f] hover:to-[#356bb0] shadow-sm shadow-[#208661]/25 border border-[#63ab91]/30",
        destructive:
          "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white shadow-xs",
        outline:
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 shadow-xs",
        secondary:
          "bg-slate-100 text-slate-800 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 shadow-xs",
        ghost:
          "text-slate-600 hover:bg-[#e9f3f0] hover:text-[#208661] border border-transparent",
        link:
          "text-[#208661] underline-offset-4 hover:underline p-0 h-auto font-normal",
        cyan:
          "bg-[#e9f3f0] text-[#208661] border border-[#63ab91]/40 hover:bg-[#208661] hover:text-white transition-all shadow-xs"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8 text-sm",
        icon: "h-8 w-8 rounded-md p-0",
        xs: "h-7 rounded-md px-2.5 text-[11px]"
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
