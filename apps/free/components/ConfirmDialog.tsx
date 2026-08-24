import PressableButton from "@/components/PressableButton";
import { createPortal } from "react-dom";

type ConfirmDialogProps = {
    title?: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
};

export default function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
    return createPortal(
        <>
            <div
                className="confirm-dialog"
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 40,
                    backgroundColor: "rgb(0 0 0 / 0.5)",
                }}
            />
            <div
                className="confirm-dialog"
                style={{
                    position: "fixed",
                    left: "50vw",
                    top: "50dvh",
                    zIndex: 50,
                    transform: "translate(-50%, -50%)",
                }}
            >
                <div className="bg-white rounded-lg p-6 w-80 text-neutral-900">
                    {title && <h2 className="text-lg font-bold">{title}</h2>}
                    <p className={`mb-4 text-sm ${title ? "mt-2 text-neutral-600" : "font-semibold"}`}>
                        {message}
                    </p>
                    <div className="flex justify-end gap-2">
                        <PressableButton variant="menu" onClick={onConfirm}>
                            Yes
                        </PressableButton>
                        <PressableButton variant="menu" onClick={onCancel}>
                            No
                        </PressableButton>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
