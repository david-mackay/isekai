import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/server/auth/session";

export default async function AuthedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/auth");
  }

  return <>{children}</>;
}

