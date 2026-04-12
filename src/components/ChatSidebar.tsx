import { createSignal, Show, For, createEffect, onCleanup, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import type { ChatMessage } from '../lib/data';
import MarkdownMessage from './MarkdownMessage';
import HardwareThumbnail from './HardwareThumbnail';
import { getHubVisualVariant, getSensorVisualVariant } from '../lib/hardwareVisuals';

const ADVISOR_STORAGE_KEY = 'poolguard-ai-advisor';
const MIN_WIDTH = 380;
const MAX_WIDTH = 760;

type ImageAttachment = {
  name: string;
  mediaType: string;
  data: string;
};

type AdvisorConversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  sessionId: number | null;
  createdAt: string;
  updatedAt: string;
  paths: string[];
  recommendationCount: number;
};

type AdvisorState = {
  open: boolean;
  highContrast: boolean;
  width: number;
  activeConversationId: string | null;
  conversations: AdvisorConversation[];
};

function clampWidth(value: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
}

function createConversation(seed?: string): AdvisorConversation {
  const now = new Date().toISOString();
  const title = seed?.trim() ? seed.trim().slice(0, 56) : 'New advisor thread';
  return {
    id: crypto.randomUUID(),
    title,
    messages: [],
    sessionId: null,
    createdAt: now,
    updatedAt: now,
    paths: [],
    recommendationCount: 0,
  };
}

function loadAdvisorState(): AdvisorState {
  if (typeof localStorage === 'undefined') {
    return { open: false, highContrast: false, width: MIN_WIDTH, activeConversationId: null, conversations: [] };
  }

  try {
    const raw = localStorage.getItem(ADVISOR_STORAGE_KEY);
    if (!raw) {
      return { open: false, highContrast: false, width: MIN_WIDTH, activeConversationId: null, conversations: [] };
    }
    const parsed = JSON.parse(raw) as Partial<AdvisorState>;
    return {
      open: Boolean(parsed.open),
      highContrast: Boolean(parsed.highContrast),
      width: clampWidth(typeof parsed.width === 'number' ? parsed.width : MIN_WIDTH),
      activeConversationId: parsed.activeConversationId ?? null,
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
    };
  } catch {
    return { open: false, highContrast: false, width: MIN_WIDTH, activeConversationId: null, conversations: [] };
  }
}

function saveAdvisorState(state: AdvisorState) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(ADVISOR_STORAGE_KEY, JSON.stringify(state));
}

function fileToAttachment(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const [, data = ''] = result.split(',');
      resolve({
        name: file.name,
        mediaType: file.type || 'image/png',
        data,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const ChatSidebar: Component = () => {
  const [open, setOpen] = createSignal(false);
  const [highContrast, setHighContrast] = createSignal(false);
  const [sidebarWidth, setSidebarWidth] = createSignal(MIN_WIDTH);
  const [conversations, setConversations] = createSignal<AdvisorConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = createSignal<string | null>(null);
  const [input, setInput] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [historyOpen, setHistoryOpen] = createSignal(true);
  const [savedBuilds, setSavedBuilds] = createSignal<any[]>([]);
  const [selectedImage, setSelectedImage] = createSignal<ImageAttachment | null>(null);

  let messagesEndRef: HTMLDivElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;
  let isResizing = false;

  const activeConversation = () =>
    conversations().find((conversation) => conversation.id === activeConversationId()) ?? null;

  const messages = () => activeConversation()?.messages ?? [];
  const sessionId = () => activeConversation()?.sessionId ?? null;

  function updateActiveConversation(updater: (conversation: AdvisorConversation) => AdvisorConversation) {
    const id = activeConversationId();
    if (!id) return;
    setConversations((current) =>
      current.map((conversation) => (conversation.id === id ? updater(conversation) : conversation))
    );
  }

  function persistState() {
    saveAdvisorState({
      open: open(),
      highContrast: highContrast(),
      width: sidebarWidth(),
      activeConversationId: activeConversationId(),
      conversations: conversations(),
    });
  }

  function ensureActiveConversation(seed?: string) {
    const existing = activeConversation();
    if (existing) return existing;
    const conversation = createConversation(seed);
    setConversations([conversation, ...conversations()]);
    setActiveConversationId(conversation.id);
    return conversation;
  }

  function touchRouteContext(pathname: string) {
    const conversation = ensureActiveConversation();
    if (conversation.paths[conversation.paths.length - 1] === pathname) return;
    updateActiveConversation((current) => ({
      ...current,
      paths: [...current.paths, pathname],
      updatedAt: new Date().toISOString(),
    }));
  }

  function createNewConversation(seed?: string) {
    const conversation = createConversation(seed);
    setConversations((current) => [conversation, ...current].slice(0, 12));
    setActiveConversationId(conversation.id);
    setInput('');
    setLoading(false);
  }

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
      if (isResizing) {
        isResizing = false;
        return;
      }
      setOpen(false);
    }
  }

  function handleResizeMove(e: PointerEvent) {
    if (!isResizing) return;
    setSidebarWidth(clampWidth(window.innerWidth - e.clientX));
  }

  function stopResizing() {
    isResizing = false;
    document.body.style.userSelect = '';
  }

  function startResizing(e: PointerEvent) {
    isResizing = true;
    document.body.style.userSelect = 'none';
    handleResizeMove(e);
  }

  onMount(() => {
    const stored = loadAdvisorState();
    setOpen(stored.open);
    setHighContrast(stored.highContrast);
    setSidebarWidth(stored.width);
    setConversations(stored.conversations);
    setActiveConversationId(stored.activeConversationId);

    if (!stored.conversations.length) {
      const conversation = createConversation();
      setConversations([conversation]);
      setActiveConversationId(conversation.id);
    }

    touchRouteContext(window.location.pathname);
    fetch('/api/configs')
      .then((response) => response.json())
      .then((data) => setSavedBuilds(Array.isArray(data) ? data.slice(0, 6) : []))
      .catch(() => {});
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointermove', handleResizeMove);
    window.addEventListener('pointerup', stopResizing);
    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointermove', handleResizeMove);
      window.removeEventListener('pointerup', stopResizing);
    });
  });

  createEffect(() => {
    persistState();
  });

  async function sendMessage() {
    const text = input().trim();
    const image = selectedImage();
    if ((!text && !image) || loading()) return;

    const prompt = text || 'Please analyze the attached pool layout and extract dimensions.';
    const conversation = ensureActiveConversation(prompt);
    const userMessage: ChatMessage = { role: 'user', content: prompt, imageName: image?.name ?? null };
    updateActiveConversation((current) => ({
      ...current,
      title: current.messages.length === 0 ? prompt.slice(0, 56) : current.title,
      messages: [...current.messages, userMessage],
      updatedAt: new Date().toISOString(),
    }));
    setInput('');
    setLoading(true);

    try {
      // Build message history for the API (without recommendation metadata)
      const apiMessages = [...conversation.messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          sessionId: conversation.sessionId,
          image,
        }),
      });

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.content,
        recommendation: data.recommendation || undefined,
      };

      updateActiveConversation((current) => ({
        ...current,
        messages: [...current.messages, assistantMessage],
        sessionId: data.sessionId ?? current.sessionId,
        recommendationCount: current.recommendationCount + (assistantMessage.recommendation ? 1 : 0),
        updatedAt: new Date().toISOString(),
      }));
    } catch {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      };
      updateActiveConversation((current) => ({
        ...current,
        messages: [...current.messages, errorMessage],
        updatedAt: new Date().toISOString(),
      }));
    } finally {
      setLoading(false);
      setSelectedImage(null);
      if (fileInputRef) fileInputRef.value = '';
    }
  }

  async function handleImageSelect(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setSelectedImage(await fileToAttachment(file));
  }

  function handleInputKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Toggle button - fixed to right edge (desktop only) */}
      <Show when={!open()}>
        <button
          onClick={() => setOpen(true)}
          class="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-bg-surface border border-r-0 border-border rounded-l-lg px-2 py-4 hover:bg-bg-card transition-colors group cursor-pointer hidden md:block"
          title="AI Advisor"
        >
          <span class="[writing-mode:vertical-lr] text-xs font-medium text-text-secondary group-hover:text-accent transition-colors">
            AI Advisor
          </span>
        </button>
      </Show>

      {/* Mobile FAB toggle (below md only) */}
      <Show when={!open()}>
        <button
          onClick={() => setOpen(true)}
          class="fixed bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-accent shadow-[0_4px_20px_rgba(0,229,160,0.3)] flex items-center justify-center md:hidden cursor-pointer active:scale-95 transition-transform"
          title="AI Advisor"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0a0b0f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
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
        <div
          class={`fixed right-0 top-0 h-full z-50 border-l flex flex-col animate-[slide-in-right_0.2s_ease] w-full md:max-w-[92vw] ${
            highContrast()
              ? 'bg-[#0f1117] border-white/12 shadow-[-18px_0_50px_rgba(0,0,0,0.4)]'
              : 'bg-bg-surface border-border'
          }`}
          style={{ width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : `${sidebarWidth()}px` }}
        >
          {/* Resize handle (desktop only) */}
          <button
            type="button"
            aria-label="Resize AI Advisor"
            class="absolute left-0 top-0 h-full w-3 -translate-x-1/2 cursor-col-resize bg-transparent hidden md:block"
            onPointerDown={startResizing}
          >
            <span class="absolute left-1/2 top-1/2 h-14 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10" />
          </button>
          {/* Header */}
          <div class={`p-4 border-b ${highContrast() ? 'border-white/10' : 'border-border'}`}>
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="font-semibold text-sm text-text-primary">AI Advisor</h3>
                <div class="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                  Persistent workspace
                </div>
              </div>
              <div class="flex items-center gap-1">
                <button
                  onClick={() => setHighContrast(!highContrast())}
                  class={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                    highContrast()
                      ? 'bg-accent/18 text-accent'
                      : 'bg-white/6 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Contrast
                </button>
                <button
                  onClick={() => createNewConversation()}
                  class="rounded-lg bg-white/6 px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  New
                </button>
                <button
                  onClick={() => setOpen(false)}
                  class="text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer p-1"
                >
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
            </div>
            <div class="mt-3 rounded-xl border border-white/6 bg-black/12">
              <button
                onClick={() => setHistoryOpen(!historyOpen())}
                class="flex w-full items-center justify-between px-3 py-2 text-left"
              >
                <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                  History
                </div>
                <div class="text-[11px] text-text-tertiary">{conversations().length} threads</div>
              </button>
              <Show when={historyOpen()}>
                <div class="max-h-44 overflow-y-auto border-t border-white/6 px-2 py-2 space-y-1">
                  <For each={conversations()}>
                    {(conversation) => (
                      <button
                        onClick={() => setActiveConversationId(conversation.id)}
                        class={`block w-full rounded-lg px-3 py-2 text-left transition-colors ${
                          activeConversationId() === conversation.id
                            ? 'bg-accent/10 text-text-primary'
                            : 'hover:bg-white/5 text-text-secondary'
                        }`}
                      >
                        <div class="truncate text-[13px] font-medium">
                          {conversation.title}
                        </div>
                        <div class="mt-1 flex items-center justify-between gap-2 text-[11px] text-text-tertiary">
                          <span>{conversation.messages.length} msgs</span>
                          <span>{conversation.recommendationCount} builds</span>
                          <span class="truncate">{conversation.paths[conversation.paths.length - 1] || '/'}</span>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
            <Show when={savedBuilds().length > 0}>
              <div class="mt-3 rounded-xl border border-white/6 bg-black/12 p-2">
                <div class="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                  Saved builds
                </div>
                <div class="space-y-1">
                  <For each={savedBuilds()}>
                    {(build) => (
                      <div class="rounded-lg px-2 py-2 hover:bg-white/4">
                        <div class="truncate text-[13px] font-medium text-text-primary">{build.name}</div>
                        <div class="mt-1 flex items-center gap-3 text-[11px] text-text-tertiary">
                          <a href={`/build?config_id=${build.id}`} class="text-accent hover:underline">Edit</a>
                          <a href={`/build?fork_from=${build.id}`} class="text-accent-blue hover:underline">Fork</a>
                          <a href={`/bom?hub_type=${build.hubType?.id ?? ''}&hub_tier=${build.hubTier?.id ?? ''}&sensor_tier=${build.sensorTier?.id ?? ''}&qty=${build.qty}`} class="hover:underline">BOM</a>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>

          {/* Messages area */}
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Welcome message when empty */}
            <Show when={messages().length === 0}>
              <div class="text-center py-8">
                <div class="text-text-tertiary text-sm mb-3">
                  Ask me about SwimSentry hardware.
                </div>
                <div class="text-text-tertiary text-xs leading-relaxed">
                  I can help you choose the right hub, sensors, and configuration
                  based on your pool size, budget, and safety needs. This thread and its build suggestions persist across page changes.
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
                    <Show when={msg.imageName}>
                      <div class="mb-3 inline-flex rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.08em] text-accent">
                        Image: {msg.imageName}
                      </div>
                    </Show>
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
          <div class={`p-4 border-t pb-[max(1rem,env(safe-area-inset-bottom))] ${highContrast() ? 'border-white/10' : 'border-border'}`}>
            <Show when={selectedImage()}>
              <div class="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.08em] text-accent">
                <span>{selectedImage()!.name}</span>
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    if (fileInputRef) fileInputRef.value = '';
                  }}
                  class="text-text-primary"
                >
                  ×
                </button>
              </div>
            </Show>
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
              <input ref={fileInputRef} type="file" accept="image/*" class="hidden" onChange={handleImageSelect} />
              <button
                onClick={() => fileInputRef?.click()}
                class="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/8"
                title="Add layout image"
              >
                Image
              </button>
              <button
                onClick={sendMessage}
                disabled={loading() || (!input().trim() && !selectedImage())}
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
