import Link from "next/link";
import { StatePage } from "@/components/site-pages";
/** Global 404 page for unknown routes. */
export default function NotFound() { return <StatePage code="404" title="Page not found" description="The page may have moved, or the link may be outdated." action={<Link href="/" className="button-secondary inline-flex px-5 font-semibold">Back home</Link>} />; }
