import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      userId: null,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  return {
    userId: session.user.id,
    response: null,
  };
}
