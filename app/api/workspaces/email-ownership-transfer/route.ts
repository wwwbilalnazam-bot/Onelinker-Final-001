import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/service";
import { emailTemplates } from "@/lib/email/templates";

export async function POST(req: NextRequest) {
  try {
    const { email, workspaceName, newOwnerName } = await req.json();

    if (!email || !workspaceName || !newOwnerName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const result = await sendEmail({
      to: email,
      subject: `${workspaceName} ownership transferred`,
      html: emailTemplates.ownershipTransferredEmail(
        email,
        workspaceName,
        newOwnerName,
        appUrl
      ),
    });

    if (!result.success) {
      console.error("[Ownership Transfer Email] Failed to send:", result.error);
      return NextResponse.json(
        { success: false, error: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Ownership Transfer Email] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
