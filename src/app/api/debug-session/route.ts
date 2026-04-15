import { auth } from "@/auth";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const allCookies = cookieStore.getAll().map((c) => ({
    name: c.name,
    valueLength: c.value.length,
    valuePreview: c.value.substring(0, 20) + "...",
  }));

  const relevantHeaders = {
    host: headerStore.get("host"),
    "x-forwarded-proto": headerStore.get("x-forwarded-proto"),
    "x-forwarded-host": headerStore.get("x-forwarded-host"),
    "x-forwarded-for": headerStore.get("x-forwarded-for"),
  };

  let session = null;
  let authError = null;
  try {
    session = await auth();
  } catch (err) {
    authError = String(err);
  }

  return NextResponse.json({
    cookies: allCookies,
    headers: relevantHeaders,
    session,
    authError,
  });
}
