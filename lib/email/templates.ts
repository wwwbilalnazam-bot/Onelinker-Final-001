import { wrapEmailTemplate } from "./service";

export const emailTemplates = {
  welcomeNewUser: (fullName: string, appUrl: string): string => {
    const content = `
      <h1>Welcome to Onelinker! 🎉</h1>
      <p>Hi ${fullName},</p>
      <p>Your account has been successfully created. You're all set to start managing your social media presence across all platforms.</p>

      <div class="highlight">
        <p><strong>What you can do now:</strong></p>
        <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
          <li>Connect your social media accounts</li>
          <li>Schedule posts across platforms</li>
          <li>Manage comments and inbox</li>
          <li>Track analytics</li>
          <li>Invite team members</li>
        </ul>
      </div>

      <p>
        <a href="${appUrl}/onboarding" class="btn">Get Started Now</a>
      </p>

      <p>If you have any questions, we're here to help! Reach out to our support team at <a href="mailto:support@onelinker.ai">support@onelinker.ai</a></p>
      <p>Best regards,<br>The Onelinker Team</p>
    `;
    return wrapEmailTemplate(content);
  },

  verificationEmail: (verificationLink: string, email: string): string => {
    const content = `
      <h1>Verify Your Email Address</h1>
      <p>Hi,</p>
      <p>Click the button below to verify your email address and activate your Onelinker account.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" class="btn">Verify Email Address</a>
      </p>

      <p>Or copy and paste this link in your browser:<br><code style="background: #f3f4f6; padding: 8px 12px; border-radius: 4px; font-size: 12px;">${verificationLink}</code></p>

      <p style="color: #6b7280; font-size: 13px;">This link will expire in 24 hours.</p>
      <p style="color: #6b7280; font-size: 13px;">If you didn't create an account, please ignore this email.</p>
      <p>Best regards,<br>The Onelinker Team</p>
    `;
    return wrapEmailTemplate(content);
  },

  invitationEmail: (
    inviterName: string,
    workspaceName: string,
    role: string,
    inviteLink: string
  ): string => {
    const content = `
      <h1>You've Been Invited! 🎊</h1>
      <p>Hi,</p>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> as a <strong>${role}</strong> on Onelinker.</p>

      <div class="highlight">
        <p><strong>What happens next:</strong></p>
        <p>Click the button below to accept the invitation and start collaborating with your team.</p>
      </div>

      <p style="text-align: center; margin: 30px 0;">
        <a href="${inviteLink}" class="btn">Accept Invitation</a>
      </p>

      <p style="color: #6b7280; font-size: 13px;">This invitation will expire in 7 days.</p>
      <p style="color: #6b7280; font-size: 13px;">If you don't have a Onelinker account, you'll be asked to create one first.</p>
      <p>Best regards,<br>The Onelinker Team</p>
    `;
    return wrapEmailTemplate(content);
  },

  memberAddedEmail: (
    workspaceName: string,
    memberName: string,
    role: string,
    appUrl: string
  ): string => {
    const content = `
      <h1>New Team Member Added</h1>
      <p>Hi,</p>
      <p><strong>${memberName}</strong> has been added to <strong>${workspaceName}</strong> as a <strong>${role}</strong>.</p>

      <div class="highlight">
        <p>They can now collaborate with your team on all workspace projects and resources.</p>
      </div>

      <p>
        <a href="${appUrl}/home" class="btn">Go to Workspace</a>
      </p>

      <p>Best regards,<br>The Onelinker Team</p>
    `;
    return wrapEmailTemplate(content);
  },

  workspaceCreatedEmail: (
    fullName: string,
    workspaceName: string,
    appUrl: string
  ): string => {
    const content = `
      <h1>Workspace Created! 🚀</h1>
      <p>Hi ${fullName},</p>
      <p>Your new workspace <strong>${workspaceName}</strong> has been successfully created.</p>

      <div class="highlight">
        <p><strong>Next steps:</strong></p>
        <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
          <li>Customize workspace settings</li>
          <li>Connect your social media accounts</li>
          <li>Invite team members</li>
          <li>Start scheduling content</li>
        </ul>
      </div>

      <p>
        <a href="${appUrl}/home" class="btn">Go to Workspace</a>
      </p>

      <p>Best regards,<br>The Onelinker Team</p>
    `;
    return wrapEmailTemplate(content);
  },

  ownershipTransferredEmail: (
    userEmail: string,
    workspaceName: string,
    newOwnerName: string,
    appUrl: string
  ): string => {
    const content = `
      <h1>Workspace Ownership Updated</h1>
      <p>Hi,</p>
      <p>The ownership of <strong>${workspaceName}</strong> has been transferred to <strong>${newOwnerName}</strong>.</p>

      <div class="highlight">
        <p>You now have member access to this workspace. Visit the workspace to see your current role and permissions.</p>
      </div>

      <p>
        <a href="${appUrl}/home" class="btn">View Workspace</a>
      </p>

      <p style="color: #6b7280; font-size: 13px;">If you have questions about this change, please contact the new workspace owner.</p>
      <p>Best regards,<br>The Onelinker Team</p>
    `;
    return wrapEmailTemplate(content);
  },

  resetPasswordEmail: (resetLink: string): string => {
    const content = `
      <h1>Reset Your Password</h1>
      <p>Hi,</p>
      <p>We received a request to reset your Onelinker password. Click the button below to set a new password.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" class="btn">Reset Password</a>
      </p>

      <p style="color: #6b7280; font-size: 13px;">This link will expire in 1 hour.</p>
      <p style="color: #6b7280; font-size: 13px;">If you didn't request a password reset, please ignore this email or contact support.</p>
      <p>Best regards,<br>The Onelinker Team</p>
    `;
    return wrapEmailTemplate(content);
  },

  accountDeactivatedEmail: (workspaceName: string, appUrl: string): string => {
    const content = `
      <h1>Account Access Deactivated</h1>
      <p>Hi,</p>
      <p>Your access to <strong>${workspaceName}</strong> has been deactivated by a workspace administrator.</p>

      <div class="highlight">
        <p>If you believe this was done in error, please contact the workspace owner or administrator.</p>
      </div>

      <p>
        <a href="${appUrl}/home" class="btn">View Your Workspaces</a>
      </p>

      <p>Best regards,<br>The Onelinker Team</p>
    `;
    return wrapEmailTemplate(content);
  },
};
