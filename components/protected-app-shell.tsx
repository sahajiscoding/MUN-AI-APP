"use client";

import { type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtectedRoute } from "@/components/protected-route";

/** Authenticated app shell requiring sign-in before rendering. */
export function ProtectedAppShell({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
