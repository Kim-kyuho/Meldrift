import { useSyncExternalStore } from "react";
import type { PeerEditor } from "@/lib/peer-live/board/editor";

const noView = () => null;
const noSubscription = () => () => {};

export function usePeerEditor(editor: PeerEditor | undefined) {
    return useSyncExternalStore(editor?.subscribe ?? noSubscription, editor?.getSnapshot ?? noView, noView);
}
