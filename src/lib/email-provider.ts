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
  const creds = sendingAccount.credentials;

  try {
    if (provider === "RESEND") {
      const apiKey = creds.apiKey as string;
      const fromEmail = creds.fromEmail as string;
      const fromName = creds.fromName as string || "";
      const replyTo = creds.replyTo as string || fromEmail;

      if (!apiKey || !fromEmail) {
        return { success: false, error: "Missing Resend API key or From Email.", errorCategory: "AUTH_ERROR" };
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
          reply_to: replyTo,
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
