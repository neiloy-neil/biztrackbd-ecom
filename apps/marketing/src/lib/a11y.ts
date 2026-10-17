import { useEffect, useRef } from "react";

/**
 * W3C APG Tabs Keyboard Navigation Pattern
 * Supports roving tab index with automatic selection upon Arrow navigation.
 */
export function handleTabListKeyDown<T extends string>(
  event: React.KeyboardEvent<HTMLElement>,
  tabs: readonly T[],
  currentTab: T,
  onChange: (tab: T) => void,
  options: { orientation?: "horizontal" | "vertical" } = {}
) {
  const orientation = options.orientation || "horizontal";
  const currentIndex = tabs.indexOf(currentTab);
  if (currentIndex === -1) return;

  const isNext =
    orientation === "horizontal"
      ? event.key === "ArrowRight" || (event.key === "ArrowDown" && !event.altKey)
      : event.key === "ArrowDown";

  const isPrev =
    orientation === "horizontal"
      ? event.key === "ArrowLeft" || (event.key === "ArrowUp" && !event.altKey)
      : event.key === "ArrowUp";

  let nextIndex: number | null = null;

  if (isNext) {
    event.preventDefault();
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (isPrev) {
    event.preventDefault();
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (event.key === "Home") {
    event.preventDefault();
    nextIndex = 0;
  } else if (event.key === "End") {
    event.preventDefault();
    nextIndex = tabs.length - 1;
  }

  if (nextIndex !== null) {
    const nextTab = tabs[nextIndex];
    if (nextTab) {
      onChange(nextTab);
      // Automatically shift focus to the newly selected tab button
      const container = event.currentTarget;
      requestAnimationFrame(() => {
        const tabButtons = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        tabButtons[nextIndex]?.focus();
      });
    }
  }
}

/**
 * W3C APG Dialog Pattern: Focus Trap & Lifecycle Hook
 * Traps Tab focus inside the active modal, listens for Escape to dismiss,
 * and restores focus to the trigger button that launched the modal upon exit.
 */
export function useModalFocusTrap(
  isOpen: boolean,
  modalRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  triggerRef?: React.RefObject<HTMLElement | null>
) {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Restore focus to trigger if modal just closed
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
        previousActiveElementRef.current = null;
      }
      return;
    }

    // Save element that had focus before opening modal
    previousActiveElementRef.current =
      triggerRef?.current || (document.activeElement as HTMLElement | null);

    // Lock background scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus first interactive element inside modal
    const focusTimer = setTimeout(() => {
      if (modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length > 0) {
          focusables[0]?.focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || !modalRef.current) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose, modalRef, triggerRef]);
}
