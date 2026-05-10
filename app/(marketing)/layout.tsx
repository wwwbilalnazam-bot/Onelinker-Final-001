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
              // Immediately remove dark class and set light theme
              html.classList.remove('dark');
              html.classList.add('light');
              html.setAttribute('data-theme', 'light');
              html.style.colorScheme = 'light';
              html.style.backgroundColor = '#ffffff';

              // Also update body
              if (document.body) {
                document.body.classList.remove('dark');
                document.body.classList.add('light');
              }
            })();

            // Observe and enforce light theme
            const observer = new MutationObserver(function() {
              const html = document.documentElement;
              if (html.classList.contains('dark')) {
                html.classList.remove('dark');
                html.classList.add('light');
              }
            });
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
          `,
        }}
      />
      <MarketingLayoutClient>{children}</MarketingLayoutClient>
    </>
  );
}
