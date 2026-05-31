import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import crossIcon from "../assets/crossWhiteIcon.svg";
import "../styles/Modal.scss";

const CLOSE_DURATION = 220; // ms — must match the CSS animation duration

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}) => {
  // `visible` keeps the DOM node alive during the exit animation.
  const [visible, setVisible] = useState(isOpen);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      setVisible(true);
    } else if (visible) {
      setClosing(true);
      const t = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, CLOSE_DURATION);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "auto";
      };
    }
  }, [isOpen, onClose]);

  if (!visible) return null;

  // Render into document.body so the overlay escapes any parent stacking
  // context (e.g. the sidebar's position:fixed / z-index on mobile).
  return createPortal(
    <div
      className={`modal-overlay${closing ? " modal-overlay--closing" : ""}`}
      onClick={onClose}
    >
      <div
        className={`modal modal-${size}${closing ? " modal--closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          {title && <h2 className="modal-title">{title}</h2>}
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <img src={crossIcon} alt="Close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
};
