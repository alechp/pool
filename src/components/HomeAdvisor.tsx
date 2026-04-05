import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { ChatMessage } from '../lib/data';
import MarkdownMessage from './MarkdownMessage';
import HardwareThumbnail from './HardwareThumbnail';
import { getHubVisualVariant, getSensorVisualVariant } from '../lib/hardwareVisuals';

const ADVISOR_STORAGE_KEY = 'poolguard-ai-advisor';
const DEMO_PROMPT = 'I have a 16×32 backyard pool with two gates and three common approach paths. What SwimSentry setup should I start with?';

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

type DemoView = 'chat' | 'build' | 'bom';

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
  const [hydrated, setHydrated] = createSignal(false);

  const [demoRunning, setDemoRunning] = createSignal(false);
  const [demoView, setDemoView] = createSignal<DemoView>('chat');
  const [demoTyped, setDemoTyped] = createSignal('');
  const [demoChatSent, setDemoChatSent] = createSignal(false);
  const [demoRecommendationShown, setDemoRecommendationShown] = createSignal(false);
  const [demoBuildHighlight, setDemoBuildHighlight] = createSignal<'none' | 'cta' | 'summary'>('none');
  const [demoBomHighlight, setDemoBomHighlight] = createSignal<'none' | 'controls' | 'pricing'>('none');
  const [demoComplete, setDemoComplete] = createSignal(false);
  const [demoHint, setDemoHint] = createSignal('Watch the advisor handle discovery, build setup, and BOM pricing.');

  let messagesEndRef: HTMLDivElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;
  let typingTimer: ReturnType<typeof setInterval> | undefined;
  const demoTimeouts: ReturnType<typeof setTimeout>[] = [];

  const demoAssistantMessage: ChatMessage = {
    role: 'assistant',
    content:
      '## Recommendation\nA **Zigbee** setup is the cleanest starting point for this layout.\n- Fast household alert routing\n- Enough coverage overlap for the two gates and long pool edge\n- Lower entry cost than a long-range gateway stack',
    recommendation: {
      hubTypeId: 'zigbee',
      hubTierId: 'zigbee-cheap',
      sensorTierId: 'zb-cheap',
      qty: 4,
      reasoning: 'Four sensors cover the primary gate approaches, long pool edge, and shallow-end activity zone without overbuilding the system.',
      hubTypeName: 'Zigbee',
      hubTierName: 'Zigbee Hub — Budget',
      sensorTierName: 'Zigbee Sensor — Budget',
    },
  };

  const activeConversation = () =>
    conversations().find((conversation) => conversation.id === activeConversationId()) ?? null;

  const messages = () => activeConversation()?.messages ?? [];

  const demoMessages = createMemo<ChatMessage[]>(() => {
    const next: ChatMessage[] = [];
    if (demoChatSent()) {
      next.push({ role: 'user', content: DEMO_PROMPT });
    }
    if (demoRecommendationShown()) {
      next.push(demoAssistantMessage);
    }
    return next;
  });

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

  function clearDemoTimers() {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = undefined;
    }
    while (demoTimeouts.length > 0) {
      const timer = demoTimeouts.pop();
      if (timer) clearTimeout(timer);
    }
  }

  function queueDemoTimeout(callback: () => void, delay: number) {
    demoTimeouts.push(setTimeout(callback, delay));
  }

  function resetDemoState(view: DemoView = 'chat') {
    clearDemoTimers();
    setDemoRunning(false);
    setDemoView(view);
    setDemoTyped('');
    setDemoChatSent(false);
    setDemoRecommendationShown(false);
    setDemoBuildHighlight('none');
    setDemoBomHighlight('none');
    setDemoComplete(false);
    setDemoHint('Watch the advisor handle discovery, build setup, and BOM pricing.');
  }

  function jumpDemo(view: DemoView) {
    resetDemoState(view);
    if (view === 'build') {
      setDemoChatSent(true);
      setDemoRecommendationShown(true);
      setDemoBuildHighlight('summary');
      setDemoHint('This guided build summary explains what the recommendation means before the user commits.');
      return;
    }

    if (view === 'bom') {
      setDemoChatSent(true);
      setDemoRecommendationShown(true);
      setDemoBuildHighlight('summary');
      setDemoBomHighlight('pricing');
      setDemoHint('From the BOM page, users price the full system, generate links, and open the final shopping set.');
    }
  }

  function playDemo() {
    setTab('demo');
    resetDemoState('chat');
    setDemoRunning(true);
    setDemoHint('Step 1: the demo highlights where the user should type.');

    let index = 0;
    typingTimer = setInterval(() => {
      index += 4;
      setDemoTyped(DEMO_PROMPT.slice(0, index));
      if (index >= DEMO_PROMPT.length && typingTimer) {
        clearInterval(typingTimer);
        typingTimer = undefined;
      }
    }, 18);

    queueDemoTimeout(() => {
      setDemoHint('Step 2: the advisor submits the question and returns a recommended build.');
      setDemoChatSent(true);
      setDemoTyped(DEMO_PROMPT);
    }, 900);

    queueDemoTimeout(() => {
      setDemoRecommendationShown(true);
      setDemoBuildHighlight('cta');
      setDemoHint('Step 3: the highlighted Apply button takes the user directly into a configured build.');
    }, 1550);

    queueDemoTimeout(() => {
      setDemoView('build');
      setDemoBuildHighlight('summary');
      setDemoHint('Step 4: the build summary explains architecture, coverage intent, sensor count, and why the recommendation fits.');
    }, 2600);

    queueDemoTimeout(() => {
      setDemoView('bom');
      setDemoBomHighlight('controls');
      setDemoHint('Step 5: the BOM workspace lets the user generate links for every part and choose a pricing strategy.');
    }, 3950);

    queueDemoTimeout(() => {
      setDemoBomHighlight('pricing');
      setDemoHint('Step 6: users review line-item pricing, supplier picks, and then save or open all selected shopping links.');
    }, 5000);

    queueDemoTimeout(() => {
      setDemoRunning(false);
      setDemoComplete(true);
      setDemoHint('The walkthrough is complete. Users can now start with their own request.');
    }, 6100);
  }

  createEffect(() => {
    if (!hydrated()) return null;
    persistAdvisorThreads(conversations(), activeConversationId());
    return null;
  });

  createEffect(() => {
    messages();
    loading();
    if (messagesEndRef) {
      messagesEndRef.scrollIntoView({ behavior: 'smooth' });
    }
    return null;
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

  onCleanup(() => {
    clearDemoTimers();
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
    if (!file || !file.type.startsWith('image/')) return;
    setSelectedImage(await fileToAttachment(file));
  }

  function handleInputKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  function startFromDemo(seed?: string) {
    resetDemoState('chat');
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
            onClick={() => {
              resetDemoState('chat');
              setTab('advisor');
            }}
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

      <Show
        when={tab() === 'advisor'}
        fallback={
          <div class="mt-6 rounded-[1.6rem] border border-white/8 bg-black/12 p-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Interactive walkthrough</div>
                <h3 class="mt-2 text-xl font-semibold text-text-primary">Watch the advisor take a user from question to priced BOM.</h3>
                <p class="mt-2 max-w-[58ch] text-sm leading-7 text-text-secondary">{demoHint()}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button onClick={playDemo} class="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg-deep">
                  Replay demo
                </button>
                <button onClick={() => jumpDemo('chat')} class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-text-primary">
                  Chat
                </button>
                <button onClick={() => jumpDemo('build')} class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-text-primary">
                  Build
                </button>
                <button onClick={() => jumpDemo('bom')} class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-text-primary">
                  BOM
                </button>
              </div>
            </div>

            <div class="mt-5 grid gap-5 xl:grid-cols-[0.58fr_0.42fr]">
              <div class="rounded-[1.5rem] border border-white/8 bg-bg-card/55 p-4">
                <Show when={demoView() === 'chat'}>
                  <div>
                    <div class="mb-4 text-[11px] font-mono uppercase tracking-[0.12em] text-text-tertiary">Demo stage: ask the advisor</div>
                    <div class="space-y-4 rounded-[1.2rem] border border-white/6 bg-black/12 p-4">
                      <Show when={demoMessages().length === 0}>
                        <div class="rounded-2xl border border-dashed border-accent/35 bg-accent/6 p-4 shadow-[0_0_0_1px_rgba(0,229,160,0.12)]">
                          <div class="text-sm font-medium text-text-primary">Highlighted input zone</div>
                          <div class="mt-2 text-sm text-text-secondary">The demo shows exactly where the user starts typing their request.</div>
                        </div>
                      </Show>

                      <For each={demoMessages()}>
                        {(msg) => (
                          <div class={msg.role === 'user' ? 'ml-8' : 'mr-8'}>
                            <div class={`rounded-2xl p-4 text-sm ${
                              msg.role === 'user'
                                ? 'bg-bg-elevated text-text-primary'
                                : 'border border-white/6 bg-bg-card/85 text-text-secondary shadow-[0_12px_30px_rgba(0,0,0,0.18)]'
                            }`}>
                              <Show when={msg.role === 'assistant'} fallback={<div class="whitespace-pre-wrap">{msg.content}</div>}>
                                <MarkdownMessage content={msg.content} />
                              </Show>
                            </div>
                            <Show when={msg.recommendation}>
                              <div class={`mt-3 overflow-hidden rounded-2xl border bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] ${
                                demoBuildHighlight() === 'cta'
                                  ? 'border-accent shadow-[0_0_0_2px_rgba(0,229,160,0.18)]'
                                  : 'border-accent/25'
                              }`}>
                                <div class="grid grid-cols-2 gap-0 border-b border-white/8 bg-bg-card/65 p-3">
                                  <HardwareThumbnail
                                    variant={getHubVisualVariant(msg.recommendation!.hubTierId ?? null)}
                                    title={msg.recommendation!.hubTierName || 'Gateway'}
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
                                    <div class="font-mono text-[11px] uppercase tracking-wider text-accent">Recommended Build</div>
                                    <div class="rounded-full border border-accent/20 bg-accent/8 px-2.5 py-1 font-mono text-[11px] text-text-primary">
                                      x{msg.recommendation!.qty} sensors
                                    </div>
                                  </div>
                                  <div class="mb-4">
                                    <MarkdownMessage content={msg.recommendation!.reasoning} class="text-[13px]" />
                                  </div>
                                  <button class={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold ${
                                    demoBuildHighlight() === 'cta'
                                      ? 'bg-accent text-bg-deep shadow-[0_0_0_6px_rgba(0,229,160,0.14)]'
                                      : 'bg-accent/85 text-bg-deep'
                                  }`}>
                                    Apply this build →
                                  </button>
                                </div>
                              </div>
                            </Show>
                          </div>
                        )}
                      </For>

                      <div class="flex gap-2">
                        <div class={`flex-1 rounded-xl border px-4 py-3 text-sm transition-all ${
                          !demoChatSent()
                            ? 'border-accent bg-accent/8 shadow-[0_0_0_2px_rgba(0,229,160,0.12)]'
                            : 'border-white/8 bg-bg-elevated'
                        }`}>
                          {demoTyped() || 'Type your pool question here…'}
                          <Show when={demoRunning() && !demoChatSent()}>
                            <span class="ml-0.5 inline-block h-4 w-[2px] bg-accent align-middle animate-pulse" />
                          </Show>
                        </div>
                        <button class={`rounded-xl px-4 py-3 text-sm font-semibold ${
                          demoChatSent() ? 'bg-accent text-bg-deep shadow-[0_0_0_6px_rgba(0,229,160,0.14)]' : 'bg-white/6 text-text-primary'
                        }`}>
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </Show>

                <Show when={demoView() === 'build'}>
                  <div>
                    <div class="mb-4 text-[11px] font-mono uppercase tracking-[0.12em] text-text-tertiary">Demo stage: guided build summary</div>
                    <div class={`rounded-[1.3rem] border p-5 ${
                      demoBuildHighlight() === 'summary'
                        ? 'border-accent bg-accent/6 shadow-[0_0_0_2px_rgba(0,229,160,0.12)]'
                        : 'border-white/8 bg-black/12'
                    }`}>
                      <div class="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Recommended configuration</div>
                          <h4 class="mt-2 text-2xl font-semibold text-text-primary">Budget Zigbee hub + 4 budget sensors</h4>
                          <p class="mt-2 max-w-[56ch] text-sm leading-7 text-text-secondary">
                            This summary tells the user what they are getting, why it fits the stated layout, and what they can still change before saving the build.
                          </p>
                        </div>
                        <div class="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                          <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Coverage target</div>
                          <div class="mt-1 text-lg font-semibold text-text-primary">2 gates + pool edge</div>
                        </div>
                      </div>

                      <div class="mt-5 grid gap-3 md:grid-cols-2">
                        <div class="rounded-2xl border border-white/6 bg-bg-card/55 p-4">
                          <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Architecture</div>
                          <div class="mt-2 text-base font-medium text-text-primary">Zigbee mesh</div>
                          <div class="mt-2 text-sm text-text-secondary">Fast alert path from sensors to the home hub with lower cost than a gateway-first design.</div>
                        </div>
                        <div class="rounded-2xl border border-white/6 bg-bg-card/55 p-4">
                          <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Sensor count</div>
                          <div class="mt-2 text-base font-medium text-text-primary">4 sensors</div>
                          <div class="mt-2 text-sm text-text-secondary">One on each major approach lane, one for the long side, and one to tighten shallow-end visibility.</div>
                        </div>
                        <div class="rounded-2xl border border-white/6 bg-bg-card/55 p-4">
                          <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Why it fits</div>
                          <div class="mt-2 text-sm text-text-secondary">The recommendation balances response time, enough overlap, and lower upfront spend for a family backyard layout.</div>
                        </div>
                        <div class="rounded-2xl border border-white/6 bg-bg-card/55 p-4">
                          <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Next action</div>
                          <div class="mt-2 text-sm text-text-secondary">Users can save, fork, or continue into the BOM page to price every part and pick suppliers.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Show>

                <Show when={demoView() === 'bom'}>
                  <div>
                    <div class="mb-4 text-[11px] font-mono uppercase tracking-[0.12em] text-text-tertiary">Demo stage: BOM pricing workspace</div>
                    <div class={`rounded-[1.3rem] border p-5 ${
                      demoBomHighlight() === 'pricing'
                        ? 'border-accent bg-accent/6 shadow-[0_0_0_2px_rgba(0,229,160,0.12)]'
                        : 'border-white/8 bg-black/12'
                    }`}>
                      <div class="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                        <div class={`rounded-2xl border p-4 ${
                          demoBomHighlight() === 'controls' ? 'border-accent bg-accent/8' : 'border-white/6 bg-bg-card/55'
                        }`}>
                          <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Generate links</div>
                          <div class="mt-3 flex flex-wrap gap-2">
                            <div class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-primary">Cheapest</div>
                            <div class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-primary">Most Expensive</div>
                            <div class="rounded-full border border-accent/20 bg-accent/10 px-3 py-2 text-sm font-medium text-accent">Highest Rating</div>
                            <div class="rounded-full bg-accent px-3 py-2 text-sm font-semibold text-bg-deep">Find Links</div>
                          </div>
                          <p class="mt-3 text-sm text-text-secondary">
                            This top row prices the full BOM in one pass instead of forcing users to source each component manually.
                          </p>
                        </div>

                        <div class="rounded-2xl border border-white/6 bg-bg-card/55 p-4">
                          <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Estimated total</div>
                          <div class="mt-2 text-3xl font-semibold text-accent">$318.40</div>
                          <div class="mt-2 text-sm text-text-secondary">Saved once the user is happy with the chosen suppliers.</div>
                        </div>
                      </div>

                      <div class="mt-4 overflow-hidden rounded-2xl border border-white/6">
                        <div class="grid grid-cols-[1.2fr_0.8fr_0.55fr_0.55fr_0.45fr] gap-4 bg-bg-card/60 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                          <div>Part</div>
                          <div>Supplier</div>
                          <div>Price</div>
                          <div>Source</div>
                          <div class="text-right">Open</div>
                        </div>
                        <div class="divide-y divide-white/6">
                          <For each={[
                            { part: 'Zigbee coordinator', supplier: 'Amazon', price: '$42.00', source: 'filter' },
                            { part: 'mmWave module', supplier: 'Seeed', price: '$18.40', source: 'manual' },
                            { part: 'ESP32 board', supplier: 'Amazon', price: '$11.20', source: 'default' },
                          ]}>
                            {(row) => (
                              <div class="grid grid-cols-[1.2fr_0.8fr_0.55fr_0.55fr_0.45fr] gap-4 px-4 py-4 text-sm">
                                <div class="text-text-primary">{row.part}</div>
                                <div class="text-text-secondary">{row.supplier}</div>
                                <div class="text-text-primary">{row.price}</div>
                                <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">{row.source}</div>
                                <div class="text-right">
                                  <span class="rounded-full bg-accent/12 px-3 py-1.5 text-xs font-medium text-accent">Open</span>
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </div>
                  </div>
                </Show>
              </div>

              <div class="space-y-4">
                <div class="rounded-[1.5rem] border border-white/8 bg-bg-card/45 p-4">
                  <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">What the demo teaches</div>
                  <div class="mt-4 space-y-3">
                    <div class={`rounded-2xl border p-4 ${demoView() === 'chat' ? 'border-accent bg-accent/8' : 'border-white/8 bg-black/12'}`}>
                      <div class="text-sm font-medium text-text-primary">1. Ask in plain language</div>
                      <div class="mt-1 text-sm text-text-secondary">The user types a real question about layout, gates, approach paths, budget, or family use case.</div>
                    </div>
                    <div class={`rounded-2xl border p-4 ${demoView() === 'build' ? 'border-accent bg-accent/8' : 'border-white/8 bg-black/12'}`}>
                      <div class="text-sm font-medium text-text-primary">2. Review the guided build summary</div>
                      <div class="mt-1 text-sm text-text-secondary">The recommendation explains architecture choice, sensor count, and the reason behind the fit.</div>
                    </div>
                    <div class={`rounded-2xl border p-4 ${demoView() === 'bom' ? 'border-accent bg-accent/8' : 'border-white/8 bg-black/12'}`}>
                      <div class="text-sm font-medium text-text-primary">3. Price the system in BOM</div>
                      <div class="mt-1 text-sm text-text-secondary">The user generates links across all parts, compares suppliers, and opens the final shopping set.</div>
                    </div>
                  </div>
                </div>

                <Show when={demoComplete()}>
                  <div class="rounded-[1.5rem] border border-accent/18 bg-accent/8 p-5">
                    <div class="text-lg font-semibold text-text-primary">Would you like to get started with your request?</div>
                    <p class="mt-2 text-sm text-text-secondary">
                      Ask about pool size, upload a layout image, or describe your safety goals and budget.
                    </p>
                    <div class="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={() => startFromDemo('I have a pool layout image. Can you extract the dimensions and recommend a sensor count?')}
                        class="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg-deep"
                      >
                        Yes, get started
                      </button>
                      <a href="/build" class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-text-primary">
                        Open builder
                      </a>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        }
      >
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
