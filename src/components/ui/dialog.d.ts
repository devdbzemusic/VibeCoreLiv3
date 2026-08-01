/**
 * Type declarations for src/components/ui/dialog.jsx (shadcn/ui Dialog).
 */
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export declare const Dialog: typeof DialogPrimitive.Root;
export declare const DialogTrigger: typeof DialogPrimitive.Trigger;
export declare const DialogPortal: typeof DialogPrimitive.Portal;
export declare const DialogClose: typeof DialogPrimitive.Close;

export interface DialogOverlayProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> {
  className?: string;
}
export declare const DialogOverlay: React.ForwardRefExoticComponent<
  DialogOverlayProps & React.RefAttributes<HTMLDivElement>
>;

export interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  className?: string;
  children?: React.ReactNode;
}
export declare const DialogContent: React.ForwardRefExoticComponent<
  DialogContentProps & React.RefAttributes<HTMLDivElement>
>;

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: React.ReactNode;
}
export declare const DialogHeader: React.FC<DialogHeaderProps>;

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: React.ReactNode;
}
export declare const DialogFooter: React.FC<DialogFooterProps>;

export interface DialogTitleProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> {
  className?: string;
  children?: React.ReactNode;
}
export declare const DialogTitle: React.ForwardRefExoticComponent<
  DialogTitleProps & React.RefAttributes<HTMLHeadingElement>
>;

export interface DialogDescriptionProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> {
  className?: string;
  children?: React.ReactNode;
}
export declare const DialogDescription: React.ForwardRefExoticComponent<
  DialogDescriptionProps & React.RefAttributes<HTMLParagraphElement>
>;
