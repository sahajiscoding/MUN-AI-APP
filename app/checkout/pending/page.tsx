import { LifecycleState } from "@/components/lifecycle-pages";
export const metadata = { title: "Payment pending" };
/** Checkout pending page shown while payment is being verified. */
export default function Page() { return <LifecycleState kind="pending" />; }
