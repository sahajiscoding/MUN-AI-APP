import { LifecycleState } from "@/components/lifecycle-pages";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Payment pending");
/** Checkout pending page shown while payment is being verified. */
export default function Page() { return <LifecycleState kind="pending" />; }
