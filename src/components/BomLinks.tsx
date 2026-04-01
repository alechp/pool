import { createSignal, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { BomLink } from '../lib/data';

interface BomLinksProps {
  partName: string;
  partDescription: string;
  targetPrice: number;
}

const BomLinks: Component<BomLinksProps> = (props) => {
  const [links, setLinks] = createSignal<BomLink[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [expanded, setExpanded] = createSignal(false);

  async function fetchLinks(refresh = false) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/bom-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partName: props.partName,
          partDescription: props.partDescription,
          targetPrice: props.targetPrice,
          refresh,
        }),
      });

      const data = await res.json();

      if (data.error && data.links.length === 0) {
        setError(data.error);
      } else {
        setLinks(data.links || []);
      }
    } catch {
      setError('Failed to fetch links');
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    const willExpand = !expanded();
    setExpanded(willExpand);
    if (willExpand && links().length === 0 && !loading()) {
      fetchLinks();
    }
  }

  function confidenceColor(confidence: string) {
    switch (confidence) {
      case 'high':
        return 'text-accent';
      case 'medium':
        return 'text-accent-amber';
      case 'low':
        return 'text-accent-coral';
      default:
        return 'text-text-tertiary';
    }
  }

  function confidenceDot(confidence: string) {
    switch (confidence) {
      case 'high':
        return 'bg-accent';
      case 'medium':
        return 'bg-accent-amber';
      case 'low':
        return 'bg-accent-coral';
      default:
        return 'bg-text-tertiary';
    }
  }

  return (
    <div>
      <Show when={!expanded()}>
        <button
          onClick={handleToggle}
          class="text-xs text-accent hover:underline cursor-pointer"
        >
          Find links
        </button>
      </Show>

      <Show when={expanded()}>
        <div class="mt-2 p-3 bg-bg-surface rounded-lg border border-border">
          {/* Header */}
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs text-text-secondary font-medium">
              Purchase links for "{props.partName}"
            </div>
            <button
              onClick={handleToggle}
              class="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer"
            >
              Close
            </button>
          </div>

          {/* Loading state */}
          <Show when={loading()}>
            <div class="flex items-center gap-2 py-4">
              <svg
                class="animate-spin w-4 h-4 text-accent"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-dasharray="32"
                  stroke-linecap="round"
                />
              </svg>
              <span class="text-xs text-text-tertiary">Searching suppliers...</span>
            </div>
          </Show>

          {/* Error state */}
          <Show when={error() && !loading()}>
            <div class="text-xs text-accent-coral py-2">{error()}</div>
          </Show>

          {/* Links list */}
          <Show when={!loading() && links().length > 0}>
            <div>
              <For each={links()}>
                {(link) => (
                  <div class="flex items-center justify-between py-2 border-b border-white/3 last:border-b-0">
                    <div class="flex items-center gap-2">
                      <span
                        class={`w-2 h-2 rounded-full ${confidenceDot(link.confidence)}`}
                      />
                      <span class={`text-sm font-medium ${confidenceColor(link.confidence)}`}>
                        {link.supplier}
                      </span>
                      <Show when={link.price}>
                        <span class="text-sm text-text-secondary">{link.price}</span>
                      </Show>
                      <Show when={link.confidence === 'low'}>
                        <span class="text-[10px] text-text-tertiary">(low conf)</span>
                      </Show>
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs text-accent hover:text-accent-dim transition-colors"
                    >
                      Visit &rarr;
                    </a>
                  </div>
                )}
              </For>

              {/* Refresh button */}
              <div class="mt-2 pt-2">
                <button
                  onClick={() => fetchLinks(true)}
                  disabled={loading()}
                  class="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
            </div>
          </Show>

          {/* Empty state (not loading, no error, no links) */}
          <Show when={!loading() && !error() && links().length === 0}>
            <div class="text-xs text-text-tertiary py-2">
              No links found yet.
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default BomLinks;
