"use client";

import { useState } from "react";
import {
  Mail, MessageSquare, Clock, MapPin, ArrowRight,
  Twitter, Linkedin, Send, CheckCircle2, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedSection, StaggerChildren } from "@/components/ui/animated-section";

const CONTACT_METHODS = [
  {
    icon: Mail,
    title: "Email us",
    description: "We respond within 24 hours on business days.",
    value: "support@onelinker.ai",
    href: "mailto:support@onelinker.ai",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    icon: Twitter,
    title: "DM on X",
    description: "Quick questions? Reach us on X (Twitter).",
    value: "@onelinker_ai",
    href: "https://x.com/onelinker_ai",
    color: "text-foreground",
    bg: "bg-muted/40",
  },
  {
    icon: Linkedin,
    title: "LinkedIn",
    description: "Follow us for updates and connect.",
    value: "Onelinker",
    href: "https://linkedin.com/company/onelinker",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
] as const;

const TOPICS = [
  "General inquiry",
  "Sales & pricing",
  "Technical support",
  "Partnership",
  "Bug report",
  "Feature request",
] as const;

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    topic: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitted(true);
        setFormData({ name: "", email: "", topic: "", message: "" });
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || "Failed to send message"}`);
      }
    } catch (err) {
      alert("Failed to send message. Please try again.");
      console.error("Contact form error:", err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/6 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 pt-16 sm:pt-24 pb-8">
          <AnimatedSection animation="fade-up" delay={100}>
            <div className="text-center">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                Contact
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
                Get in touch
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
                Have a question, need help, or want to partner with us? We&apos;d love to hear from you.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Contact methods */}
      <section className="max-w-6xl mx-auto px-5 pb-12">
        <StaggerChildren animation="fade-up" staggerMs={100} className="grid sm:grid-cols-3 gap-4">
          {CONTACT_METHODS.map((m) => (
            <a
              key={m.title}
              href={m.href}
              target={m.href.startsWith("http") ? "_blank" : undefined}
              rel={m.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="group rounded-2xl border border-border/50 bg-card/60 p-5 hover:border-border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl mb-3", m.bg)}>
                <m.icon className={cn("h-5 w-5", m.color)} />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{m.title}</h3>
              <p className="text-xs text-muted-foreground mb-2">{m.description}</p>
              <span className="text-xs font-medium text-primary group-hover:underline">{m.value}</span>
            </a>
          ))}
        </StaggerChildren>
      </section>

      {/* Contact form + info */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Form */}
          <AnimatedSection animation="fade-right" className="lg:col-span-3 rounded-2xl border border-border/50 bg-card/60 p-6 sm:p-8">
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 mb-5">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Message sent!</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Thanks for reaching out. We&apos;ll get back to you within 24 hours on business days.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setFormData({ name: "", email: "", topic: "", message: "" }); }}
                  className="mt-6 text-sm font-medium text-primary hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-foreground mb-1">Send us a message</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Fill out the form and we&apos;ll get back to you as soon as possible.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-name" className="text-xs font-semibold text-foreground mb-1.5 block">Name</label>
                      <input
                        id="contact-name"
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Your name"
                        className="w-full rounded-xl border border-border/60 bg-background/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="text-xs font-semibold text-foreground mb-1.5 block">Email</label>
                      <input
                        id="contact-email"
                        required
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-border/60 bg-background/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-topic" className="text-xs font-semibold text-foreground mb-1.5 block">Topic</label>
                    <select
                      id="contact-topic"
                      required
                      value={formData.topic}
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      className="w-full rounded-xl border border-border/60 bg-background/60 px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all"
                    >
                      <option value="" disabled>Select a topic</option>
                      {TOPICS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="text-xs font-semibold text-foreground mb-1.5 block">Message</label>
                    <textarea
                      id="contact-message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="How can we help?"
                      className="w-full rounded-xl border border-border/60 bg-background/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-glow-sm disabled:opacity-50"
                  >
                    {sending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                    ) : (
                      <><Send className="h-4 w-4" /> Send message</>
                    )}
                  </button>
                </form>
              </>
            )}
          </AnimatedSection>

          {/* Sidebar info */}
          <AnimatedSection animation="fade-left" className="lg:col-span-2 space-y-5">
            <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
              <h3 className="text-sm font-bold text-foreground mb-4">Quick answers</h3>
              <div className="space-y-4">
                {[
                  { q: "How do I reset my password?", a: "Go to the login page and click \"Forgot password\" to receive a reset link." },
                  { q: "Can I change my plan?", a: "Yes. Go to Settings > Billing to upgrade or downgrade at any time." },
                  { q: "How do I connect a new platform?", a: "Go to Accounts and click \"Connect Account\" to authorize via OAuth." },
                ].map((item) => (
                  <div key={item.q}>
                    <p className="text-xs font-semibold text-foreground mb-1">{item.q}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
              <h3 className="text-sm font-bold text-foreground mb-3">Response times</h3>
              <div className="space-y-3">
                {[
                  { label: "General inquiries", time: "Within 24 hours" },
                  { label: "Technical support", time: "Within 12 hours" },
                  { label: "Critical issues", time: "Within 4 hours" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                      <Clock className="h-3 w-3 text-emerald-400" /> {item.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
