/**
 * Type declarations for src/components/ui/button.jsx (shadcn/ui Button).
 * This file gives TypeScript full prop coverage without modifying the .jsx source.
 */
import * as React from "react";
import { VariantProps } from "class-variance-authority";

export declare const buttonVariants: (props?: {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}) => string;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  className?: string;
}

export declare const Button: React.ForwardRefExoticComponent<
  ButtonProps & React.RefAttributes<HTMLButtonElement>
>;
