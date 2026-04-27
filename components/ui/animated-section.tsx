"use client";

import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/hooks/useScrollReveal";

type AnimationType = "fade-up" | "fade-down" | "fade-left" | "fade-right" | "scale" | "blur";

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  once?: boolean;
  as?: React.ElementType;
}

const animationStyles: Record<AnimationType, { hidden: string; visible: string }> = {
  "fade-up": {
    hidden: "opacity-0 translate-y-8",
    visible: "opacity-100 translate-y-0",
  },
  "fade-down": {
    hidden: "opacity-0 -translate-y-8",
    visible: "opacity-100 translate-y-0",
  },
  "fade-left": {
    hidden: "opacity-0 translate-x-8",
    visible: "opacity-100 translate-x-0",
  },
  "fade-right": {
    hidden: "opacity-0 -translate-x-8",
    visible: "opacity-100 translate-x-0",
  },
  scale: {
    hidden: "opacity-0 scale-95",
    visible: "opacity-100 scale-100",
  },
  blur: {
    hidden: "opacity-0 blur-sm translate-y-4",
    visible: "opacity-100 blur-0 translate-y-0",
  },
};

export function AnimatedSection({
  children,
  className,
  animation = "fade-up",
  delay = 0,
  duration = 700,
  once = true,
  as: Tag = "div",
}: AnimatedSectionProps) {
  const [ref, isVisible] = useScrollReveal<HTMLDivElement>({ once });
  const styles = animationStyles[animation];

  return (
    <Tag
      ref={ref}
      className={cn(
        "transition-all",
        isVisible ? styles.visible : styles.hidden,
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {children}
    </Tag>
  );
}

export function StaggerChildren({
  children,
  className,
  staggerMs = 100,
  animation = "fade-up",
  duration = 600,
}: {
  children: React.ReactNode;
  className?: string;
  staggerMs?: number;
  animation?: AnimationType;
  duration?: number;
}) {
  const [ref, isVisible] = useScrollReveal<HTMLDivElement>();
  const styles = animationStyles[animation];

  // Handle both array and single children
  const childrenArray = Array.isArray(children) ? children : [children];

  return (
    <div ref={ref} className={className}>
      {childrenArray.map((child, i) => (
        <div
          key={i}
          className={cn(
            "transition-all",
            isVisible ? styles.visible : styles.hidden,
          )}
          style={{
            transitionDuration: `${duration}ms`,
            transitionDelay: `${i * staggerMs}ms`,
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
