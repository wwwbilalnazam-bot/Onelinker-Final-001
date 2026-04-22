import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/service";
import { emailTemplates } from "@/lib/email/templates";

export async function POST(req: NextRequest) {
  try {
    const { userId, email, fullName } = await req.json();

    if (!userId || !email || !fullName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const result = await sendEmail({
      to: email,
      subject: "Welcome to Onelinker!",
      html: emailTemplates.welcomeNewUser(fullName, appUrl),
    });

    if (!result.success) {
      console.error("[Welcome Email] Failed to send:", result.error);
      return NextResponse.json(
        { success: false, error: "Failed to send welcome email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Welcome Email] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
