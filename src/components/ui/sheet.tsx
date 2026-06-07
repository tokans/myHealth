import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** A side/bottom drawer built on Radix Dialog (matches ReportIssueDialog styling). */
export const Sheet = Dialog.Root;
export const SheetClose = Dialog.Close;

type Side = "right" | "left" | "bottom";

const SIDE: Record<Side, string> = {
  right:
    "inset-y-0 right-0 h-full w-80 max-w-[85vw] border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  left:
    "inset-y-0 left-0 h-full w-80 max-w-[85vw] border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
  bottom:
    "inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
};

export function SheetContent({
  side = "right",
  title,
  description,
  className,
  children,
  ...props
}: {
  side?: Side;
  title: string;
  description?: string;
} & Omit<React.ComponentPropsWithoutRef<typeof Dialog.Content>, "title">) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <Dialog.Content
        className={cn(
          "fixed z-50 flex flex-col bg-background shadow-lg focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300",
          SIDE[side],
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <Dialog.Title className="text-base font-semibold tracking-tight">{title}</Dialog.Title>
            {description && (
              <Dialog.Description className="text-sm text-muted-foreground">
                {description}
              </Dialog.Description>
            )}
          </div>
          <Dialog.Close className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
