import { Overlay } from "@/components/modals/Overlay";

export function Modal({ isOpen, onClose, title, children }) {
  return (
    <Overlay isOpen={isOpen} onClose={onClose} title={title} mode="modal">
      {children}
    </Overlay>
  );
}
