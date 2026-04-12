import type { Metadata } from "next";
import { AuthLayoutClient } from "./layout-client";

export const metadata: Metadata = {
  title: {
    template: "%s | Onelinker",
    default: "Onelinker",
  },
  description: "Schedule smarter. Grow faster.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const html = document.documentElement;
              html.classList.remove('dark');
              html.classList.add('light');
              html.style.colorScheme = 'light';
            })();
          `,
        }}
      />
      <AuthLayoutClient>{children}</AuthLayoutClient>
    </>
  );
}
