"use client";
import { useId, useLayoutEffect, useRef, type ReactNode } from "react";

export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleRef = useRef<HTMLHeadingElement>(null),
    id = useId();
  useLayoutEffect(() => {
    const dialog = ref.current!,
      trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    titleRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      if (trigger?.isConnected && !trigger.matches(":disabled"))
        trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const elements = Array.from(
          ref.current!.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]',
          ),
        ).filter((el) => el.getClientRects().length > 0);
        const first = elements[0],
          last = elements.at(-1);
        if (!first) {
          e.preventDefault();
          titleRef.current?.focus();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === titleRef.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
    >
      <div className="modal-heading">
        <h2 id={id} ref={titleRef} tabIndex={-1}>
          {title}
        </h2>
        <button aria-label="Закрыть окно" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
