import { createSignal, Show, For, createEffect, onCleanup, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import type { ChatMessage } from '../lib/data';
import MarkdownMessage from './MarkdownMessage';
import HardwareThumbnail from './HardwareThumbnail';
import { getHubVisualVariant, getSensorVisualVariant } from '../lib/hardwareVisuals';

const ChatSidebar: Component = () => {
  const [open, setOpen] = createSignal(false);
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [input, setInput] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [sessionId, setSessionId] = createSignal<number | null>(null);

  let messagesEndRef: HTMLDivElement | undefined;

  // Auto-scroll to bottom when messages change
  createEffect(() => {
    // Read messages to track dependency
    messages();
    loading();
    if (messagesEndRef) {
      messagesEndRef.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Close sidebar on Escape key
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open()) {
      setOpen(false);
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  async function sendMessage() {
    const text = input().trim();
    if (!text || loading()) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Build message history for the API (without recommendation metadata)
      const apiMessages = messages().map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          sessionId: sessionId(),
        }),
      });

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.content,
        recommendation: data.recommendation || undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.sessionId && !sessionId()) {
        setSessionId(data.sessionId);
      }
    } catch {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleInputKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Toggle button - fixed to right edge */}
      <Show when={!open()}>
        <button
          onClick={() => setOpen(true)}
          class="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-bg-surface border border-r-0 border-border rounded-l-lg px-2 py-4 hover:bg-bg-card transition-colors group cursor-pointer"
          title="AI Advisor"
        >
          <span class="[writing-mode:vertical-lr] text-xs font-medium text-text-secondary group-hover:text-accent transition-colors">
            AI Advisor
          </span>
        </button>
      </Show>

      {/* Mobile backdrop overlay */}
      <Show when={open()}>
        <div
          class="fixed inset-0 bg-black/50 z-40 md:hidden animate-[fade-in_0.15s_ease]"
          onClick={() => setOpen(false)}
        />
      </Show>

      {/* Sidebar panel */}
      <Show when={open()}>
        <div class="fixed right-0 top-0 h-full w-[380px] max-w-[90vw] z-50 bg-bg-surface border-l border-border flex flex-col animate-[slide-in-right_0.2s_ease]">
          {/* Header */}
          <div class="flex items-center justify-between p-4 border-b border-border">
            <h3 class="font-semibold text-sm text-text-primary">AI Advisor</h3>
            <button
              onClick={() => setOpen(false)}
              class="text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer p-1"
            >
              {/* X close icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Messages area */}
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Welcome message when empty */}
            <Show when={messages().length === 0}>
              <div class="text-center py-8">
                <div class="text-text-tertiary text-sm mb-3">
                  Ask me about pool security hardware.
                </div>
                <div class="text-text-tertiary text-xs leading-relaxed">
                  I can help you choose the right hub, sensors, and configuration
                  based on your pool size, budget, and safety needs.
                </div>
              </div>
            </Show>

            <For each={messages()}>
              {(msg) => (
                <div class={msg.role === 'user' ? 'ml-8' : 'mr-8'}>
                  <div
                    class={`rounded-lg p-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-bg-elevated text-text-primary'
                        : 'border border-white/6 bg-bg-card/85 text-text-secondary shadow-[0_12px_30px_rgba(0,0,0,0.2)]'
                    }`}
                  >
                    <Show
                      when={msg.role === 'assistant'}
                      fallback={<div class="whitespace-pre-wrap">{msg.content}</div>}
                    >
                      <MarkdownMessage content={msg.content} />
                    </Show>
                  </div>

                  {/* Recommendation card */}
                  <Show when={msg.recommendation}>
                    <div class="mt-3 overflow-hidden rounded-2xl border border-accent/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]">
                      <div class="grid grid-cols-2 gap-0 border-b border-white/8 bg-bg-card/65 p-3">
                        <HardwareThumbnail
                          variant={getHubVisualVariant(msg.recommendation!.hubTierId ?? null)}
                          title={msg.recommendation!.hubTierName || msg.recommendation!.hubTypeName || 'Gateway'}
                          class="aspect-[4/3]"
                        />
                        <HardwareThumbnail
                          variant={getSensorVisualVariant(msg.recommendation!.sensorTierId)}
                          title={msg.recommendation!.sensorTierName || 'Sensor'}
                          class="aspect-[4/3]"
                        />
                      </div>
                      <div class="p-4">
                        <div class="mb-3 flex items-center justify-between gap-3">
                          <div class="font-mono text-[11px] uppercase tracking-wider text-accent">
                            Recommended Build
                          </div>
                          <div class="rounded-full border border-accent/20 bg-accent/8 px-2.5 py-1 font-mono text-[11px] text-text-primary">
                            x{msg.recommendation!.qty} sensors
                          </div>
                        </div>
                        <div class="mb-2 grid gap-2">
                          <div class="rounded-xl border border-white/6 bg-black/12 px-3 py-2 text-[13px] text-text-secondary">
                            <span class="text-text-primary">{msg.recommendation!.hubTierName || msg.recommendation!.hubTypeName}</span>
                          </div>
                          <div class="rounded-xl border border-white/6 bg-black/12 px-3 py-2 text-[13px] text-text-secondary">
                            <span class="text-text-primary">{msg.recommendation!.sensorTierName}</span>
                          </div>
                        </div>
                        <div class="mb-4">
                          <MarkdownMessage content={msg.recommendation!.reasoning} class="text-[13px]" />
                        </div>
                        <a
                          href={`/build?hub_type=${msg.recommendation!.hubTypeId}&hub_tier=${msg.recommendation!.hubTierId || ''}&sensor_tier=${msg.recommendation!.sensorTierId}`}
                          class="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg-deep transition-colors hover:bg-accent-dim"
                        >
                          Apply this build →
                        </a>
                      </div>
                    </div>
                  </Show>
                </div>
              )}
            </For>

            {/* Loading indicator */}
            <Show when={loading()}>
              <div class="mr-8">
                <div class="text-text-tertiary text-sm animate-pulse">Thinking...</div>
              </div>
            </Show>

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div class="p-4 border-t border-border">
            <div class="flex gap-2">
              <input
                type="text"
                value={input()}
                onInput={(e) => setInput(e.currentTarget.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Ask about pool hardware..."
                disabled={loading()}
                class="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active transition-colors disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={loading() || !input().trim()}
                class="bg-accent text-bg-deep px-3 py-2 rounded-lg text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                title="Send"
              >
                {/* Send arrow icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M14 2L7 9" />
                  <path d="M14 2l-5 12-2-5-5-2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};

export default ChatSidebar;
