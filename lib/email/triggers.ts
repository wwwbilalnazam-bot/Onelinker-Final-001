export interface EmailTriggerOptions {
  baseUrl?: string;
}

const getBaseUrl = (baseUrl?: string): string => {
  return baseUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
};

async function triggerEmail(endpoint: string, data: any): Promise<boolean> {
  const baseUrl = getBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error(`[Email Trigger] ${endpoint} failed:`, response.statusText);
      return false;
    }

    const result = await response.json();
    return result.success ?? true;
  } catch (error) {
    console.error(`[Email Trigger] ${endpoint} error:`, error);
    return false;
  }
}

export const emailTriggers = {
  sendWelcomeEmail: async (
    userId: string,
    email: string,
    fullName: string
  ) => {
    return triggerEmail("auth/welcome-email", { userId, email, fullName });
  },

  sendInvitationEmail: async (
    email: string,
    inviterName: string,
    workspaceName: string,
    role: string,
    inviteLink: string
  ) => {
    return triggerEmail("invitations/send", {
      email,
      inviterName,
      workspaceName,
      role,
      inviteLink,
    });
  },

  sendMemberAddedEmail: async (
    memberEmail: string,
    memberName: string,
    workspaceName: string,
    workspaceId: string
  ) => {
    return triggerEmail("workspaces/email-member-added", {
      memberEmail,
      memberName,
      workspaceName,
      workspaceId,
    });
  },

  sendWorkspaceCreatedEmail: async (
    email: string,
    fullName: string,
    workspaceName: string
  ) => {
    return triggerEmail("workspaces/email-workspace-created", {
      email,
      fullName,
      workspaceName,
    });
  },

  sendOwnershipTransferEmail: async (
    email: string,
    workspaceName: string,
    newOwnerName: string
  ) => {
    return triggerEmail("workspaces/email-ownership-transfer", {
      email,
      workspaceName,
      newOwnerName,
    });
  },

  sendAccountDeactivatedEmail: async (
    email: string,
    workspaceName: string
  ) => {
    return triggerEmail("workspaces/email-deactivated", {
      email,
      workspaceName,
    });
  },

  sendResetPasswordEmail: async (email: string, resetLink: string) => {
    return triggerEmail("auth/reset-password-email", {
      email,
      resetLink,
    });
  },
};
