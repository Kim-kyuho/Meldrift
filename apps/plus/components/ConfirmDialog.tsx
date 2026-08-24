import PressableButton from "@/components/PressableButton";
import { createPortal } from "react-dom";

type ConfirmDialogProps = {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
};

export default function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
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
                    <p className="mb-4 text-sm font-semibold">{message}</p>
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
