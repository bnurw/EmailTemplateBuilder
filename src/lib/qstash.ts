import { Client, Receiver } from "@upstash/qstash";

const qstashToken = process.env.QSTASH_TOKEN ?? "mock_qstash_token";

export const qstashClient = new Client({ token: qstashToken });

export const qstashReceiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY ?? "mock_current_key",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? "mock_next_key",
});

export async function verifyQStashSignature(signature: string | null, body: string): Promise<boolean> {
  if (!signature || process.env.NODE_ENV === "development" && process.env.BYPASS_QSTASH_SIGNATURE === "true") {
    return true;
  }
  if (!signature) return false;
  try {
    return await qstashReceiver.verify({ signature, body });
  } catch (error) {
    console.error("QStash signature verification failed:", error);
    return false;
  }
}
