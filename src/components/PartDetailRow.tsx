import { createSignal, For, Show, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import type { BomLink, Part } from '../lib/data';
import HardwareThumbnail from './HardwareThumbnail';
import { getPartVisualVariant } from '../lib/hardwareVisuals';

interface Props {
  part: Part;
  sectionLabel: string;
}

const PartDetailRow: Component<Props> = (props) => {
  const [open, setOpen] = createSignal(false);
  const [links, setLinks] = createSignal<BomLink[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [loaded, setLoaded] = createSignal(false);
  const [panelX, setPanelX] = createSignal(0);
  const [panelY, setPanelY] = createSignal(0);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function cancelClose() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer = setTimeout(() => setOpen(false), 140);
  }

  function placePanel(e: MouseEvent | FocusEvent) {
    if (e instanceof MouseEvent) {
      const width = Math.min(520, window.innerWidth - 48);
      setPanelX(Math.min(e.clientX + 18, window.innerWidth - width - 24));
      setPanelY(Math.max(88, e.clientY - 36));
    }
  }

  async function loadLinks(forceLive = false) {
    if (loading()) return;

    setLoading(true);
    setError(null);

    try {
      const cachedResponse = await fetch(`/api/bom-links?partName=${encodeURIComponent(props.part.name)}`);
      const cachedData = await cachedResponse.json();

      if (!forceLive && Array.isArray(cachedData.links) && cachedData.links.length > 0) {
        setLinks(cachedData.links);
        setLoaded(true);
        return;
      }

      const liveResponse = await fetch('/api/bom-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partName: props.part.name,
          partDescription: props.part.description,
          targetPrice: props.part.price,
          refresh: forceLive,
        }),
      });
      const liveData = await liveResponse.json();

      if (Array.isArray(liveData.links) && liveData.links.length > 0) {
        setLinks(liveData.links);
      } else {
        setError(liveData.error || 'No links found yet');
      }
      setLoaded(true);
    } catch {
      setError('Unable to load suppliers right now');
    } finally {
      setLoading(false);
    }
  }

  function handleOpen(e?: MouseEvent | FocusEvent) {
    cancelClose();
    if (!open() && e) placePanel(e);
    setOpen(true);
    if (!loaded()) {
      loadLinks();
    }
  }

  function topLink() {
    return links()[0] ?? null;
  }

  function confidenceTone(confidence: BomLink['confidence']) {
    switch (confidence) {
      case 'high':
        return 'text-accent';
      case 'medium':
        return 'text-accent-amber';
      default:
        return 'text-accent-coral';
    }
  }

  onCleanup(() => {
    if (closeTimer) clearTimeout(closeTimer);
  });

  return (
    <div class="group relative grid grid-cols-[88px_1fr_auto] gap-4 py-3 border-b border-white/3 last:border-b-0 items-center">
      <HardwareThumbnail
        variant={getPartVisualVariant(props.part.name)}
        title={props.part.name}
        class="aspect-[4/3]"
      />
      <div class="min-w-0">
        <div class="text-sm font-medium">{props.part.name}</div>
        <div class="text-xs text-text-tertiary mt-0.5">{props.part.description}</div>
      </div>
      <div class="flex items-center gap-3 whitespace-nowrap">
        <Show when={topLink()} fallback={<button type="button" onClick={() => loadLinks(true)} class="text-xs text-accent hover:underline">Find links</button>}>
          {(link) => (
            <button
              type="button"
              class="rounded-full bg-accent/12 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
              onMouseEnter={handleOpen}
              onMouseLeave={scheduleClose}
              onFocus={handleOpen}
              onBlur={scheduleClose}
              onClick={(e) => {
                if (!open()) {
                  handleOpen(e);
                } else {
                  setOpen(false);
                }
              }}
            >
              Buy from {link().supplier}
            </button>
          )}
        </Show>
        <div class="font-mono text-sm font-medium text-right">${props.part.price}</div>
      </div>

      <Show when={open()}>
        <div
          class="fixed z-30 w-[min(32rem,calc(100vw-4rem))] rounded-2xl border border-white/8 bg-[#0f1218]/98 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur"
          style={{ left: `${panelX()}px`, top: `${panelY()}px` }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div class="mb-3 flex items-start justify-between gap-3">
            <div>
              <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">{props.sectionLabel}</div>
              <div class="mt-1 text-base font-semibold text-text-primary">{props.part.name}</div>
              <div class="mt-1 text-sm leading-6 text-text-secondary">{props.part.description}</div>
            </div>
            <div class="font-mono text-lg font-medium text-text-primary">${props.part.price}</div>
          </div>

          <div class="mb-4 grid gap-2 rounded-xl border border-white/6 bg-white/3 p-3">
            <div class="text-[13px] text-text-secondary">
              This component exists to support the <span class="text-text-primary">{props.sectionLabel.toLowerCase()}</span> build. Hovering any part now exposes its role and current supplier options without leaving the review flow.
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 mb-2">
            <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Purchase links</div>
            <button
              type="button"
              onClick={() => loadLinks(true)}
              disabled={loading()}
              class="text-xs text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-50"
            >
              Refresh live links
            </button>
          </div>

          <Show when={loading()}>
            <div class="py-4 text-sm text-text-tertiary">Loading suppliers…</div>
          </Show>

          <Show when={!loading() && error()}>
            <div class="py-2 text-sm text-accent-coral">{error()}</div>
          </Show>

          <Show when={!loading() && links().length > 0}>
            <div class="space-y-2">
              <For each={links()}>
                {(link) => (
                  <div class="flex items-center justify-between gap-4 rounded-xl border border-white/6 bg-black/12 px-3 py-3">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <div class={`text-sm font-medium ${confidenceTone(link.confidence)}`}>{link.supplier}</div>
                        <Show when={link.price}>
                          <div class="text-xs text-text-tertiary">{link.price}</div>
                        </Show>
                      </div>
                      <div class="mt-1 text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
                        {link.confidence} confidence
                      </div>
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      class="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-bg-deep transition-colors hover:bg-accent-dim"
                    >
                      Open →
                    </a>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default PartDetailRow;
