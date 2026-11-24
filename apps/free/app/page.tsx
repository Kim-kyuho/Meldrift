import BoardClient from "@/components/BoardClient";
import { peerLiveConfigured } from "@/lib/peer-live/signaling/store";

export default function Home() {
    return <BoardClient peerLiveEnabled={peerLiveConfigured()} />;
}
