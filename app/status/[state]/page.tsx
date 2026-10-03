import { notFound } from "next/navigation";
import { LifecycleState } from "@/components/lifecycle-pages";
const states = new Set(["403", "404", "500", "maintenance", "offline", "empty", "no-search-results", "loading", "error", "success", "session-expired"]);
export const dynamic = "force-dynamic";
/** Generic status page rendering the lifecycle state for the given key. */
export default async function StatusPage({ params }: { params: Promise<{ state: string }> }) { const { state } = await params; if (!states.has(state)) notFound(); const kind = state === "403" ? "forbidden" : state === "404" ? "not-found" : state === "500" ? "server-error" : state === "no-search-results" ? "search" : state === "session-expired" ? "session" : state as "pending" | "failed" | "success" | "offline" | "maintenance" | "session" | "empty" | "search" | "loading" | "error"; return <LifecycleState kind={kind} />; }
