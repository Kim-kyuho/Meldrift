import type { ButtonHTMLAttributes } from "react";
import PressableButton from "@meldrift/ui/PressableButton";

const tones = {
    primary: "border-sky-500 bg-sky-500 text-white hover:bg-sky-400",
    neutral: "border-neutral-200 bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
    sky: "border-sky-200 bg-sky-100 text-sky-800 hover:bg-sky-200",
    emerald: "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
    rose: "border-rose-200 bg-rose-100 text-rose-800 hover:bg-rose-200",
};

const sizes = {
    regular: "min-h-9 border px-3 py-2 text-sm shadow-sm",
    compact: "min-h-8 rounded-lg border-[0.75px] px-2.5 py-1 text-xs shadow-xs",
};

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    tone?: keyof typeof tones;
    size?: keyof typeof sizes;
};

export default function RoomActionButton({ tone = "neutral", size = "regular", type = "button", ...props }: Props) {
    return (
        <PressableButton {...props} type={type}
            className={`cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${tones[tone]}`}
        />
    );
}
