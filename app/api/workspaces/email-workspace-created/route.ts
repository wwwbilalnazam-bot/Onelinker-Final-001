import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/service";
import { emailTemplates } from "@/lib/email/templates";

export async function POST(req: NextRequest) {
  try {
    const { email, fullName, workspaceName } = await req.json();

    if (!email || !fullName || !workspaceName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const result = await sendEmail({
      to: email,
      subject: `Workspace created: ${workspaceName}`,
      html: emailTemplates.workspaceCreatedEmail(fullName, workspaceName, appUrl),
    });

    if (!result.success) {
      console.error("[Workspace Created Email] Failed to send:", result.error);
      return NextResponse.json(
        { success: false, error: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Workspace Created Email] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
