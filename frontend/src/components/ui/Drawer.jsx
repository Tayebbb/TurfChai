import { Overlay } from "@/components/modals/Overlay";

export function Drawer({ isOpen, onClose, title, children }) {
  return (
    <Overlay isOpen={isOpen} onClose={onClose} title={title} mode="drawer">
      {children}
    </Overlay>
  );
}
