import { Metadata } from "next";
import { MarketingLayoutClient } from "./layout-client";

export const metadata: Metadata = {
  title: "Onelinker — AI-Powered Social Media Management for 10+ Platforms",
  description: "Schedule posts, generate content with AI, and track analytics for Twitter, Instagram, Facebook, TikTok, LinkedIn, and more. All-in-one social media toolkit.",
  keywords: "social media management, social media scheduler, AI content creator, Twitter automation, Instagram scheduler, TikTok manager",
};

export default function MarketingLayout({
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
      <MarketingLayoutClient>{children}</MarketingLayoutClient>
    </>
  );
}
