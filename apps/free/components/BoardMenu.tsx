"use client";

import Image from "next/image";
import Link from "next/link";
import SharedBoardMenu, { type BoardMenuProps } from "@meldrift/ui/BoardMenu";

export default function BoardMenu(props: Omit<BoardMenuProps, "brand">) {
    return (
        <SharedBoardMenu
            {...props}
            brand={
                <Link href="/" aria-label="Meldrift home"
                    className="flex items-center gap-1.5 transition duration-300 hover:opacity-75 active:scale-[0.98]"
                    style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}>
                    <Image src="/meldrift-mascot.png" alt="" width={256} height={256} priority className="size-7 shrink-0" />
                    <Image src="/meldrift-wordmark.png" alt="meldrift" width={512} height={127} priority className="h-auto w-21 sm:w-24" />
                </Link>
            }
        />
    );
}
