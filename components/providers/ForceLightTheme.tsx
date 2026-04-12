"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

/**
 * Forces light theme while mounted, restores previous theme on unmount.
 * Drop this into any layout that should never be dark.
 */
export function ForceLightTheme() {
  const { theme, setTheme } = useTheme();
  const previousTheme = useRef<string | undefined>();

  useEffect(() => {
    // Get current theme from html element
    const htmlElement = document.documentElement;
    const currentTheme = htmlElement.classList.contains("dark") ? "dark" : "light";

    if (currentTheme !== "light") {
      previousTheme.current = currentTheme;
      // Remove dark class and ensure light is set
      htmlElement.classList.remove("dark");
      htmlElement.classList.add("light");
      setTheme("light");
    }

    return () => {
      if (previousTheme.current === "dark") {
        htmlElement.classList.add("dark");
        htmlElement.classList.remove("light");
        setTheme("dark");
      }
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
