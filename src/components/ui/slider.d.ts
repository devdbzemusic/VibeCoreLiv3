/**
 * Type declarations for src/components/ui/slider.jsx (shadcn/ui Slider).
 */
import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

export interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  className?: string;
}
export declare const Slider: React.ForwardRefExoticComponent<
  SliderProps & React.RefAttributes<HTMLSpanElement>
>;
