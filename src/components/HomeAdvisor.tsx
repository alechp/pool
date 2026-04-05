import { createSignal, Show, For, createEffect, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import type { ChatMessage } from '../lib/data';
import MarkdownMessage from './MarkdownMessage';
import HardwareThumbnail from './HardwareThumbnail';
import { getHubVisualVariant, getSensorVisualVariant } from '../lib/hardwareVisuals';

const ADVISOR_STORAGE_KEY = 'poolguard-ai-advisor';

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

type ImageAttachment = {
  name: string;
  mediaType: string;
  data: string;
};

const demoMessages: ChatMessage[] = [
  {
    role: 'user',
    content: 'I have a medium backyard pool, two kids under 8, and I want fast alerts without overspending.',
  },
  {
    role: 'assistant',
    content: '## Fit\nA **Zigbee** setup is usually the best starting point for that case.\n- Low-latency alerts\n- Strong indoor-to-yard mesh coverage\n- Lower hardware cost than long-range gateway systems',
    recommendation: {
      hubTypeId: 'zigbee',
      hubTierId: 'zigbee-cheap',
      sensorTierId: 'zb-cheap',
      qty: 4,
      reasoning: 'A mesh setup balances cost, response time, and coverage for a typical family backyard.',
      hubTypeName: 'Zigbee',
      hubTierName: 'Zigbee Hub — Budget',
      sensorTierName: 'Zigbee Sensor — Budget',
    },
  },
  {
    role: 'user',
    content: 'Here is my pool layout. Can you estimate whether four sensors are enough and read the dimensions from the plan?',
    imageName: 'pool-layout.png',
  },
  {
    role: 'assistant',
    content: '## Layout Review\nIf the drawing includes labeled dimensions, I can extract them directly and use those measurements to size the sensor layout.\n\n## Next Step\nAfter that, I can recommend a build, generate the BOM, and help you choose the best supplier links.',
  },
];

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
    return { open: false, highContrast: false, width: 380, activeConversationId: null, conversations: [] };
  }

  try {
    const raw = localStorage.getItem(ADVISOR_STORAGE_KEY);
    if (!raw) return { open: false, highContrast: false, width: 380, activeConversationId: null, conversations: [] };
    const parsed = JSON.parse(raw) as Partial<AdvisorState>;
    return {
      open: Boolean(parsed.open),
      highContrast: Boolean(parsed.highContrast),
      width: typeof parsed.width === 'number' ? parsed.width : 380,
      activeConversationId: parsed.activeConversationId ?? null,
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
    };
  } catch {
    return { open: false, highContrast: false, width: 380, activeConversationId: null, conversations: [] };
  }
}

function persistAdvisorThreads(conversations: AdvisorConversation[], activeConversationId: string | null) {
  if (typeof localStorage === 'undefined') return;
  const current = loadAdvisorState();
  localStorage.setItem(
    ADVISOR_STORAGE_KEY,
    JSON.stringify({
      ...current,
      conversations,
      activeConversationId,
    })
  );
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

const HomeAdvisor: Component = () => {
  const [tab, setTab] = createSignal<'advisor' | 'demo'>('advisor');
  const [conversations, setConversations] = createSignal<AdvisorConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = createSignal<string | null>(null);
  const [input, setInput] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [historyOpen, setHistoryOpen] = createSignal(true);
  const [selectedImage, setSelectedImage] = createSignal<ImageAttachment | null>(null);
  const [demoStep, setDemoStep] = createSignal(0);
  const [demoPlaying, setDemoPlaying] = createSignal(false);
  const [hydrated, setHydrated] = createSignal(false);

  let messagesEndRef: HTMLDivElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;

  const activeConversation = () =>
    conversations().find((conversation) => conversation.id === activeConversationId()) ?? null;

  const messages = () => activeConversation()?.messages ?? [];

  function updateActiveConversation(updater: (conversation: AdvisorConversation) => AdvisorConversation) {
    const id = activeConversationId();
    if (!id) return;
    setConversations((current) =>
      current.map((conversation) => (conversation.id === id ? updater(conversation) : conversation))
    );
  }

  function ensureActiveConversation(seed?: string) {
    const existing = activeConversation();
    if (existing) return existing;
    const conversation = createConversation(seed);
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    return conversation;
  }

  function createNewConversation(seed?: string) {
    const conversation = createConversation(seed);
    setConversations((current) => [conversation, ...current].slice(0, 12));
    setActiveConversationId(conversation.id);
    setInput('');
    setSelectedImage(null);
  }

  createEffect(() => {
    if (!hydrated()) return;
    persistAdvisorThreads(conversations(), activeConversationId());
  });

  createEffect(() => {
    messages();
    loading();
    if (messagesEndRef) {
      messagesEndRef.scrollIntoView({ behavior: 'smooth' });
    }
  });

  onMount(() => {
    const stored = loadAdvisorState();
    setConversations(stored.conversations);
    setActiveConversationId(stored.activeConversationId);

    if (!stored.conversations.length) {
      const conversation = createConversation();
      setConversations([conversation]);
      setActiveConversationId(conversation.id);
    }

    setHydrated(true);
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
      paths: current.paths[current.paths.length - 1] === '/' ? current.paths : [...current.paths, '/'],
    }));
    setInput('');
    setLoading(true);

    try {
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
      updateActiveConversation((current) => ({
        ...current,
        messages: [
          ...current.messages,
          {
            role: 'assistant',
            content: 'AI chat is temporarily unavailable. Please try again.',
          },
        ],
        updatedAt: new Date().toISOString(),
      }));
    } finally {
      setLoading(false);
      setSelectedImage(null);
      if (fileInputRef) fileInputRef.value = '';
    }
  }

  async function handleImageSelect(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setSelectedImage(await fileToAttachment(file));
  }

  function handleInputKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  function playDemo() {
    setTab('demo');
    setDemoPlaying(true);
    setDemoStep(0);
    demoMessages.forEach((_, index) => {
      window.setTimeout(() => {
        setDemoStep(index + 1);
      }, index * 1100);
    });
    window.setTimeout(() => {
      setDemoPlaying(false);
    }, demoMessages.length * 1100);
  }

  function startFromDemo(seed?: string) {
    setTab('advisor');
    if (seed) setInput(seed);
  }

  return (
    <section class="rounded-[2rem] border border-white/8 bg-bg-surface/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)] md:p-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">Inline AI Advisor</div>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-text-primary">Plan with SwimSentry before you click into the builder.</h2>
        </div>
        <div class="inline-flex rounded-xl border border-white/8 bg-black/12 p-1">
          <button
            onClick={() => setTab('advisor')}
            class={`rounded-lg px-4 py-2 text-sm font-medium ${tab() === 'advisor' ? 'bg-bg-card text-text-primary' : 'text-text-tertiary'}`}
          >
            Ask AI
          </button>
          <button
            onClick={playDemo}
            class={`rounded-lg px-4 py-2 text-sm font-medium ${tab() === 'demo' ? 'bg-bg-card text-text-primary' : 'text-text-tertiary'}`}
          >
            Demo
          </button>
        </div>
      </div>

      <Show when={tab() === 'advisor'} fallback={
        <div class="mt-6 rounded-[1.6rem] border border-white/8 bg-black/12 p-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Demo flow</div>
              <h3 class="mt-2 text-xl font-semibold text-text-primary">See how to ask for sizing, recommendations, and BOM help.</h3>
            </div>
            <button onClick={playDemo} class="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg-deep">
              Replay demo
            </button>
          </div>
          <div class="mt-5 space-y-4">
            <For each={demoMessages.slice(0, demoStep())}>
              {(msg) => (
                <div class={msg.role === 'user' ? 'ml-8' : 'mr-8'}>
                  <div class={`rounded-2xl p-4 text-sm ${msg.role === 'user' ? 'bg-bg-elevated text-text-primary' : 'border border-white/6 bg-bg-card/85 text-text-secondary'}`}>
                    <Show when={msg.imageName}>
                      <div class="mb-3 inline-flex rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.08em] text-accent">
                        Image: {msg.imageName}
                      </div>
                    </Show>
                    <Show when={msg.role === 'assistant'} fallback={<div class="whitespace-pre-wrap">{msg.content}</div>}>
                      <MarkdownMessage content={msg.content} />
                    </Show>
                  </div>
                  <Show when={msg.recommendation}>
                    <div class="mt-3 overflow-hidden rounded-2xl border border-accent/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]">
                      <div class="grid grid-cols-2 gap-0 border-b border-white/8 bg-bg-card/65 p-3">
                        <HardwareThumbnail variant={getHubVisualVariant(msg.recommendation!.hubTierId ?? null)} title={msg.recommendation!.hubTierName || 'Gateway'} class="aspect-[4/3]" />
                        <HardwareThumbnail variant={getSensorVisualVariant(msg.recommendation!.sensorTierId)} title={msg.recommendation!.sensorTierName || 'Sensor'} class="aspect-[4/3]" />
                      </div>
                      <div class="p-4">
                        <div class="font-mono text-[11px] uppercase tracking-wider text-accent">Recommended Build</div>
                        <div class="mt-3 text-sm text-text-secondary">
                          <MarkdownMessage content={msg.recommendation!.reasoning} class="text-[13px]" />
                        </div>
                      </div>
                    </div>
                  </Show>
                </div>
              )}
            </For>
            <Show when={demoPlaying()}>
              <div class="text-sm text-text-tertiary animate-pulse">Simulating advisor conversation…</div>
            </Show>
          </div>
          <Show when={!demoPlaying() && demoStep() >= demoMessages.length}>
            <div class="mt-6 rounded-2xl border border-accent/18 bg-accent/8 p-5">
              <div class="text-lg font-semibold text-text-primary">Ready to try your own request?</div>
              <p class="mt-2 text-sm text-text-secondary">
                Ask about pool size, upload a layout image, or describe your safety goals and budget.
              </p>
              <div class="mt-4 flex flex-wrap gap-3">
                <button onClick={() => startFromDemo('I have a pool layout image. Can you extract the dimensions and recommend a sensor count?')} class="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg-deep">
                  Yes, get started
                </button>
                <a href="/build" class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-text-primary">
                  Open builder
                </a>
              </div>
            </div>
          </Show>
        </div>
      }>
        <div class="mt-6 grid gap-5 lg:grid-cols-[0.36fr_0.64fr]">
          <div class="rounded-[1.6rem] border border-white/8 bg-black/12 p-4">
            <div class="mb-3 flex items-center justify-between">
              <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Threads</div>
              <button onClick={() => createNewConversation()} class="rounded-lg bg-white/6 px-3 py-1.5 text-[11px] font-medium text-text-secondary hover:text-text-primary">
                New
              </button>
            </div>
            <button
              onClick={() => setHistoryOpen(!historyOpen())}
              class="mb-2 flex w-full items-center justify-between rounded-xl border border-white/6 bg-bg-card/60 px-3 py-2 text-left"
            >
              <span class="text-sm text-text-primary">Saved advisor history</span>
              <span class="text-[11px] text-text-tertiary">{conversations().length} threads</span>
            </button>
            <Show when={historyOpen()}>
              <div class="space-y-2">
                <For each={conversations()}>
                  {(conversation) => (
                    <button
                      onClick={() => setActiveConversationId(conversation.id)}
                      class={`block w-full rounded-xl px-3 py-3 text-left transition-colors ${
                        activeConversationId() === conversation.id ? 'bg-accent/10 text-text-primary' : 'bg-white/4 text-text-secondary hover:bg-white/7'
                      }`}
                    >
                      <div class="truncate text-sm font-medium">{conversation.title}</div>
                      <div class="mt-1 flex items-center justify-between gap-2 text-[11px] text-text-tertiary">
                        <span>{conversation.messages.length} msgs</span>
                        <span>{conversation.recommendationCount} builds</span>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div class="rounded-[1.6rem] border border-white/8 bg-black/12">
            <div class="border-b border-white/6 px-5 py-4">
              <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Advisor workspace</div>
              <p class="mt-2 max-w-[56ch] text-sm text-text-secondary">
                Ask for architecture guidance, BOM help, or upload a layout image so the advisor can read visible dimensions and estimate sensor coverage.
              </p>
            </div>

            <div class="max-h-[34rem] overflow-y-auto px-5 py-4 space-y-4">
              <Show when={messages().length === 0}>
                <div class="rounded-2xl border border-dashed border-white/10 bg-white/3 p-5 text-sm text-text-secondary">
                  Start with a plain-language request like `I have a 16x32 pool with two entry points`, or upload a labeled site plan image.
                </div>
              </Show>
              <For each={messages()}>
                {(msg) => (
                  <div class={msg.role === 'user' ? 'ml-8' : 'mr-8'}>
                    <div class={`rounded-2xl p-4 text-sm ${msg.role === 'user' ? 'bg-bg-elevated text-text-primary' : 'border border-white/6 bg-bg-card/85 text-text-secondary shadow-[0_12px_30px_rgba(0,0,0,0.18)]'}`}>
                      <Show when={msg.imageName}>
                        <div class="mb-3 inline-flex rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.08em] text-accent">
                          Image: {msg.imageName}
                        </div>
                      </Show>
                      <Show when={msg.role === 'assistant'} fallback={<div class="whitespace-pre-wrap">{msg.content}</div>}>
                        <MarkdownMessage content={msg.content} />
                      </Show>
                    </div>
                    <Show when={msg.recommendation}>
                      <div class="mt-3 overflow-hidden rounded-2xl border border-accent/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]">
                        <div class="grid grid-cols-2 gap-0 border-b border-white/8 bg-bg-card/65 p-3">
                          <HardwareThumbnail variant={getHubVisualVariant(msg.recommendation!.hubTierId ?? null)} title={msg.recommendation!.hubTierName || msg.recommendation!.hubTypeName || 'Gateway'} class="aspect-[4/3]" />
                          <HardwareThumbnail variant={getSensorVisualVariant(msg.recommendation!.sensorTierId)} title={msg.recommendation!.sensorTierName || 'Sensor'} class="aspect-[4/3]" />
                        </div>
                        <div class="p-4">
                          <div class="mb-3 flex items-center justify-between gap-3">
                            <div class="font-mono text-[11px] uppercase tracking-wider text-accent">Recommended Build</div>
                            <div class="rounded-full border border-accent/20 bg-accent/8 px-2.5 py-1 font-mono text-[11px] text-text-primary">
                              x{msg.recommendation!.qty} sensors
                            </div>
                          </div>
                          <div class="mb-4">
                            <MarkdownMessage content={msg.recommendation!.reasoning} class="text-[13px]" />
                          </div>
                          <a href={`/build?hub_type=${msg.recommendation!.hubTypeId}&hub_tier=${msg.recommendation!.hubTierId || ''}&sensor_tier=${msg.recommendation!.sensorTierId}`} class="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg-deep transition-colors hover:bg-accent-dim">
                            Apply this build →
                          </a>
                        </div>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
              <Show when={loading()}>
                <div class="text-sm text-text-tertiary animate-pulse">Thinking…</div>
              </Show>
              <div ref={messagesEndRef} />
            </div>

            <div class="border-t border-white/6 px-5 py-4">
              <Show when={selectedImage()}>
                <div class="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.08em] text-accent">
                  <span>{selectedImage()!.name}</span>
                  <button onClick={() => { setSelectedImage(null); if (fileInputRef) fileInputRef.value = ''; }} class="text-text-primary">
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
                  placeholder="Ask about layout sizing, hub selection, sensors, or BOM sourcing..."
                  disabled={loading()}
                  class="flex-1 rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active"
                />
                <input ref={fileInputRef} type="file" accept="image/*" class="hidden" onChange={handleImageSelect} />
                <button onClick={() => fileInputRef?.click()} class="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary">
                  Add image
                </button>
                <button onClick={() => void sendMessage()} disabled={loading() || (!input().trim() && !selectedImage())} class="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-bg-deep disabled:opacity-50">
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </section>
  );
};

export default HomeAdvisor;
