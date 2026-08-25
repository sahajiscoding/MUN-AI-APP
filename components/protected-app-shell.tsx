"use client";

import { type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtectedRoute } from "@/components/protected-route";

export function ProtectedAppShell({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
