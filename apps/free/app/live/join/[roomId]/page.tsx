import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JoinRoomClient from "@/components/peer-live/JoinRoomClient";
import { roomIdSchema } from "@/lib/peer-live/signaling/protocol";

export const metadata: Metadata = { title: "Join a shared Meldrift board", referrer: "no-referrer", robots: { index: false } };

export default async function JoinRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
    const { roomId } = await params;
    if (!roomIdSchema.safeParse(roomId).success) {
        notFound();
    }
    return <JoinRoomClient roomId={roomId} />;
}
