"use client";

import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";

const isInvitation = (path: string) => path.startsWith("/live/join/");

export default function FreeAnalytics() {
    const path = usePathname();
    if (path && isInvitation(path)) {
        return null;
    }
    return <Analytics beforeSend={(event) => isInvitation(new URL(event.url, window.location.origin).pathname) ? null : event} />;
}
