import { useEffect, useRef, type ComponentProps } from 'react';
import { TakeoffModal } from '@takeoff-tokyo/ui';
export function AccessibleModal(props: ComponentProps<typeof TakeoffModal>) {
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = wrapper.current?.querySelector<HTMLElement>('[role="dialog"]');
    const nodes = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) || [],
      ).filter((n) => n.getClientRects().length);
    dialog?.setAttribute(
      'aria-label',
      typeof props.title === 'string' ? props.title : 'Ticket dialog',
    );
    const inactive: { node: HTMLElement; was: boolean }[] = [];
    let branch: HTMLElement | null = wrapper.current;
    while (branch?.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          inactive.push({ node: sibling, was: sibling.inert });
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    const timer = setTimeout(() => nodes()[0]?.focus(), 0);
    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const all = nodes();
      const first = all[0],
        last = all.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', trap);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', trap);
      for (const item of inactive) item.node.inert = item.was;
      previous?.focus();
    };
  }, [props.isOpen]);
  return (
    <div ref={wrapper}>
      <TakeoffModal {...props} className={`ticket-modal ${props.className || ''}`.trim()} />
    </div>
  );
}
