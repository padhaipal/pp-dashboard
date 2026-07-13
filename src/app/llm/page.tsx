import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { MODELS } from "./models";
import { LlmConsole, type ClientModel } from "./llm-console";

// Same auth-gate as /dashboard: any signed-in session, else /login.
export default async function LlmPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  // Only booleans + public metadata cross to the client — never key values.
  const models: ClientModel[] = MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    envKey: m.envKey,
    priceIn: m.priceIn,
    priceOut: m.priceOut,
    available: Boolean(process.env[m.envKey]),
  }));

  return <LlmConsole models={models} />;
}
