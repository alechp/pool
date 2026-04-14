import { createSignal, onCleanup, Show, For, onMount } from 'solid-js';
import type { Component } from 'solid-js';

interface DropdownProps {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  class?: string;
}

const Dropdown: Component<DropdownProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  const [focusedIndex, setFocusedIndex] = createSignal(-1);
  let triggerRef: HTMLButtonElement | undefined;
  let menuRef: HTMLDivElement | undefined;

  const selectedLabel = () => {
    const v = props.value;
    if (!v) return null;
    const opt = props.options.find((o) => o.value === v);
    return opt ? opt.label : null;
  };

  function handleClickOutside(e: MouseEvent) {
    if (
      triggerRef &&
      !triggerRef.contains(e.target as Node) &&
      menuRef &&
      !menuRef.contains(e.target as Node)
    ) {
      setOpen(false);
      setFocusedIndex(-1);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!open()) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < props.options.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev > 0 ? prev - 1 : props.options.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex() >= 0 && focusedIndex() < props.options.length) {
          const opt = props.options[focusedIndex()];
          props.onChange(opt.value === props.value ? null : opt.value);
        }
        setOpen(false);
        setFocusedIndex(-1);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setFocusedIndex(-1);
        triggerRef?.focus();
        break;
    }
  }

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside);
    onCleanup(() => {
      document.removeEventListener('mousedown', handleClickOutside);
    });
  });

  return (
    <div class={`relative ${props.class || ''}`}>
      <button
        ref={triggerRef}
        type="button"
        class="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary cursor-pointer flex items-center justify-between gap-2 min-w-[160px] hover:border-border-hover transition-colors outline-none focus:border-border-active"
        onClick={() => {
          setOpen(!open());
          if (!open()) setFocusedIndex(-1);
        }}
        onKeyDown={handleKeyDown}
      >
        <span class={selectedLabel() ? 'text-text-primary' : 'text-text-secondary'}>
          {selectedLabel() || props.placeholder}
        </span>
        <svg
          class={`w-4 h-4 text-text-tertiary transition-transform ${open() ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      <Show when={open()}>
        <div
          ref={menuRef}
          class="absolute z-50 mt-1 bg-bg-card border border-border rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-1 min-w-full animate-[dropdown-in_0.15s_ease]"
          role="listbox"
        >
          <For each={props.options}>
            {(option, idx) => (
              <div
                class={`px-3 py-2 text-sm text-text-primary hover:bg-bg-card-hover cursor-pointer flex items-center justify-between transition-colors ${
                  option.value === props.value ? 'text-accent' : ''
                } ${focusedIndex() === idx() ? 'bg-bg-card-hover' : ''}`}
                role="option"
                aria-selected={option.value === props.value}
                onClick={() => {
                  props.onChange(option.value === props.value ? null : option.value);
                  setOpen(false);
                  setFocusedIndex(-1);
                  triggerRef?.focus();
                }}
                onMouseEnter={() => setFocusedIndex(idx())}
              >
                <span>{option.label}</span>
                <Show when={option.value === props.value}>
                  <svg
                    class="w-4 h-4 text-accent"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M3 8.5l3.5 3.5 6.5-7" />
                  </svg>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default Dropdown;
