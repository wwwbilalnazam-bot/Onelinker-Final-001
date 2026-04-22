# Email Notifications Setup Guide

## Overview

The email system is fully configured with Resend for sending transactional emails. The system supports multiple email events with beautiful, professional templates.

## Configuration

### Environment Variables

**Already configured:**
- `RESEND_API_KEY`: Your Resend API key
- `RESEND_FROM_EMAIL`: Sender email address (hello@onelinker.ai)
- `NEXT_PUBLIC_APP_URL`: Base URL for email links

## Email Events

### 1. **Account Creation / Welcome Email**
When a new user signs up, they receive a welcome email.

**Triggered:** On signup completion
**File:** `/lib/email/templates.ts` → `welcomeNewUser()`
**API:** `POST /api/auth/welcome-email`

**Usage in code:**
```typescript
import { emailTriggers } from "@/lib/email/triggers";

await emailTriggers.sendWelcomeEmail(userId, email, fullName);
```

### 2. **Email Verification**
Email verification is handled by Supabase Auth (sends automatic verification link).

**File:** `/lib/email/templates.ts` → `verificationEmail()`
*Note: This is available if you need to send custom verification emails*

### 3. **Workspace Invitation**
When someone invites a user to a workspace, an invitation email is sent.

**Triggered:** When calling `POST /api/invitations/send`
**File:** `/app/api/invitations/send/route.ts`
**Template:** `/lib/email/templates.ts` → `invitationEmail()`

**7-day expiration** on invitation tokens.

### 4. **Member Added to Workspace**
When a member is added to a workspace, they receive a notification.

**File:** `/app/api/workspaces/email-member-added/route.ts`
**Template:** `/lib/email/templates.ts` → `memberAddedEmail()`

**Usage in code:**
```typescript
await emailTriggers.sendMemberAddedEmail(
  memberEmail,
  memberName,
  workspaceName,
  workspaceId
);
```

### 5. **Workspace Created**
When a new workspace is created, the owner receives a confirmation email.

**File:** `/app/api/workspaces/email-workspace-created/route.ts`
**Template:** `/lib/email/templates.ts` → `workspaceCreatedEmail()`

**Usage in code:**
```typescript
await emailTriggers.sendWorkspaceCreatedEmail(
  ownerEmail,
  ownerFullName,
  workspaceName
);
```

### 6. **Ownership Transfer**
When workspace ownership is transferred, both old and new owners are notified.

**File:** `/app/api/workspaces/email-ownership-transfer/route.ts`
**Template:** `/lib/email/templates.ts` → `ownershipTransferredEmail()`

**Usage in code:**
```typescript
await emailTriggers.sendOwnershipTransferEmail(
  oldOwnerEmail,
  workspaceName,
  newOwnerName
);
```

### 7. **Account Deactivated**
When an admin deactivates a user's access to a workspace.

**File:** `/app/api/workspaces/email-deactivated/route.ts`
**Template:** `/lib/email/templates.ts` → `accountDeactivatedEmail()`

**Usage in code:**
```typescript
await emailTriggers.sendAccountDeactivatedEmail(
  userEmail,
  workspaceName
);
```

### 8. **Password Reset**
When a user requests a password reset.

**File:** `/app/api/auth/reset-password-email/route.ts`
**Template:** `/lib/email/templates.ts` → `resetPasswordEmail()`

**Usage in code:**
```typescript
await emailTriggers.sendResetPasswordEmail(
  userEmail,
  resetLink
);
```

## Architecture

### File Structure
```
lib/email/
├── service.ts        # Resend client & core email functions
├── templates.ts      # All email HTML templates
└── triggers.ts       # Helper functions to trigger emails from anywhere

app/api/auth/
├── welcome-email/route.ts
└── reset-password-email/route.ts

app/api/invitations/
└── send/route.ts     # Already existed, now uses new templates

app/api/workspaces/
├── email-member-added/route.ts
├── email-workspace-created/route.ts
├── email-ownership-transfer/route.ts
└── email-deactivated/route.ts
```

### Core Components

#### 1. **Email Service** (`lib/email/service.ts`)
- `sendEmail()`: Core function to send emails via Resend
- `wrapEmailTemplate()`: Wraps content in professional HTML structure

#### 2. **Email Templates** (`lib/email/templates.ts`)
- Pre-built templates for all email types
- Consistent styling and branding
- Responsive HTML design

#### 3. **Email Triggers** (`lib/email/triggers.ts`)
- Helper functions to trigger emails from anywhere in the app
- Non-blocking calls to email API routes
- Centralized email trigger interface

## Usage Examples

### Sending Welcome Email (from signup page)
```typescript
// This is already integrated in signup/page.tsx
fetch("/api/auth/welcome-email", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
  }),
});
```

### Sending Invitation Email (from workspace settings)
```typescript
import { emailTriggers } from "@/lib/email/triggers";

const workspace = await getWorkspace(workspaceId);
const inviter = await getUser();

await emailTriggers.sendInvitationEmail(
  inviteeEmail,
  inviter.full_name,
  workspace.name,
  "editor",
  `${appUrl}/invite/accept?token=${token}`
);
```

### Integrating New Email Events

To add a new email event:

1. **Create the template** in `lib/email/templates.ts`:
```typescript
eventName: (param1: string, param2: string): string => {
  const content = `
    <h1>Subject</h1>
    <p>Your content here...</p>
  `;
  return wrapEmailTemplate(content);
}
```

2. **Create the API route** at `app/api/path/route.ts`:
```typescript
import { sendEmail } from "@/lib/email/service";
import { emailTemplates } from "@/lib/email/templates";

export async function POST(req: NextRequest) {
  const { param1, param2 } = await req.json();
  
  const result = await sendEmail({
    to: email,
    subject: "Subject",
    html: emailTemplates.eventName(param1, param2),
  });

  return NextResponse.json({ success: result.success });
}
```

3. **Add trigger helper** in `lib/email/triggers.ts`:
```typescript
sendEventName: async (param1: string, param2: string) => {
  return triggerEmail("path/route", { param1, param2 });
}
```

4. **Use it anywhere**:
```typescript
import { emailTriggers } from "@/lib/email/triggers";

await emailTriggers.sendEventName(param1, param2);
```

## Testing

### 1. Test Email Sending Locally
```bash
npm run dev
```

Visit signup page and create a test account. Watch the server logs:
```
[Email] Sent to test@example.com: Welcome to Onelinker!
```

### 2. Check Email Delivery
- Monitor your Resend dashboard at https://resend.com/emails
- All sent emails appear there with status

### 3. Test Different Events
- **Signup:** Create new account
- **Invitation:** Use workspace settings to invite member
- **Password Reset:** Use forgot password flow

### 4. Preview Email Templates
The HTML templates are self-contained. You can test them by:
- Sending a test email to your Resend domain
- Checking the Resend dashboard preview

## Best Practices

1. **Non-blocking Email Sends**: Use `fetch()` without `await` for non-critical emails (like welcome emails during signup)

2. **Error Handling**: Email failures don't block user operations. Check logs:
```bash
grep "\[Email\]" .next/server.log
```

3. **Personalization**: Always use user data (name, workspace name) to personalize emails

4. **Links**: All links use `NEXT_PUBLIC_APP_URL` environment variable

5. **Rate Limiting**: Resend has built-in rate limiting. High-volume operations should be throttled

6. **Bounce Handling**: Resend automatically handles bounces. Check dashboard for delivery issues

## Troubleshooting

### Emails Not Sending?

1. **Check RESEND_API_KEY**:
```bash
echo $RESEND_API_KEY
```

2. **Check logs**:
```bash
npm run dev | grep "\[Email\]"
```

3. **Verify endpoint**: Test with curl:
```bash
curl -X POST http://localhost:3000/api/auth/welcome-email \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","email":"test@example.com","fullName":"Test"}'
```

4. **Check Resend dashboard**: https://resend.com/emails

### Email Template Issues?

1. Check `lib/email/templates.ts` for syntax errors
2. Verify `wrapEmailTemplate()` is wrapping content properly
3. Test HTML rendering in browser

### Slow Email Delivery?

- Resend typically delivers within seconds
- Check Resend dashboard for processing delays
- Verify network connectivity

## Support

For issues with:
- **Email sending**: Check Resend dashboard and API key
- **Templates**: Review `lib/email/templates.ts`
- **Routes**: Check API route handler logic
- **Triggers**: Use `emailTriggers` helpers instead of direct API calls

## Next Steps

1. Test all email flows in development
2. Monitor Resend dashboard for delivery stats
3. Add email analytics if needed
4. Consider email unsubscribe links for marketing emails
5. Set up email preview/test account for QA
