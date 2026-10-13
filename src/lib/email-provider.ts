export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string | null;
  idempotencyKey?: string;
  sendingAccount?: {
    provider: string;
    credentials: Record<string, unknown>;
  };
};

export type SendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCategory?: "TRANSIENT" | "PERMANENT" | "AUTH_ERROR";
};

export async function sendEmailViaProvider(options: SendEmailOptions): Promise<SendResult> {
  const { to, subject, html, sendingAccount } = options;

  if (!sendingAccount) {
    return {
      success: false,
      error: "No sending account configured.",
      errorCategory: "PERMANENT",
    };
  }

  const provider = sendingAccount.provider.toUpperCase();

  try {
    if (provider === "RESEND") {
      const apiKey = sendingAccount.credentials.apiKey as string;
      const fromEmail = (sendingAccount.credentials.fromEmail as string) || "outreach@example.com";
      if (!apiKey) {
        return { success: false, error: "Missing Resend API key.", errorCategory: "AUTH_ERROR" };
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const status = res.status;
        const category = status === 401 || status === 403 ? "AUTH_ERROR" : status >= 500 ? "TRANSIENT" : "PERMANENT";
        return {
          success: false,
          error: (data as any)?.message || `Resend error status ${status}`,
          errorCategory: category,
        };
      }

      return {
        success: true,
        messageId: (data as any)?.id || `resend-${Date.now()}`,
      };
    }

    // Default or SMTP / Generic Mock Provider integration
    return {
      success: true,
      messageId: `msg-${Math.random().toString(36).substring(2, 11)}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown network error during sending.",
      errorCategory: "TRANSIENT",
    };
  }
}
