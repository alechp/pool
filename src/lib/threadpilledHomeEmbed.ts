import { ThreadPilledVanillaEmbed, parseDiagram } from '@threadpilled-embed-vanilla';

type ViewKey = 'overview' | 'build' | 'bom';

type Labels = Record<ViewKey, string>;
type Sources = Record<ViewKey, string>;

export async function mountThreadpilledHomeEmbed(
  root: HTMLElement,
  dropdown: HTMLElement,
  trigger: HTMLButtonElement,
  current: HTMLElement,
  optionNodes: HTMLButtonElement[],
  diagramSources: Sources
) {
  const labels: Labels = {
    overview: 'Overview',
    build: 'Build Flow',
    bom: 'BOM Flow',
  };
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let activeView: ViewKey = 'overview';
  let embed: ThreadPilledVanillaEmbed | null = null;
  let diagnosticsEl: HTMLElement | null = null;
  let retryButton: HTMLButtonElement | null = null;

  function ensureDiagnosticsEl() {
    if (diagnosticsEl && diagnosticsEl.parentElement === root) return diagnosticsEl;
    diagnosticsEl = document.createElement('div');
    diagnosticsEl.className = 'tp-home-diagnostics';
    diagnosticsEl.hidden = true;
    root.appendChild(diagnosticsEl);
    return diagnosticsEl;
  }

  function setEmbedState(state: 'loading' | 'ready' | 'error') {
    root.dataset.embedState = state;
  }

  function waitForAnimation(durationMs: number) {
    if (prefersReducedMotion.matches || durationMs <= 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let start = 0;
      const tick = (timestamp: number) => {
        if (!start) start = timestamp;
        if (timestamp - start >= durationMs) {
          resolve();
          return;
        }
        window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    });
  }

  function scrollToTarget(id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({
      behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  function handlePillNavigation(pillId: string) {
    switch (pillId) {
      case 'user':
      case 'advisor':
        scrollToTarget('home-advisor');
        return;
      case 'system':
        scrollToTarget('hardware-explorer');
        return;
      case 'build':
        window.location.href = '/build';
        return;
      case 'bom':
        window.location.href = '/bom';
        return;
      default:
        return;
    }
  }

  function setDiagnostics(title: string, details: string[], level: 'error' | 'info' = 'error') {
    const panel = ensureDiagnosticsEl();
    setEmbedState(level === 'error' ? 'error' : 'ready');
    panel.hidden = false;
    panel.dataset.level = level;
    panel.innerHTML = `
      <div class="tp-home-diagnostics__eyebrow">ThreadPilled diagnostics</div>
      <div class="tp-home-diagnostics__title">${title}</div>
      <div class="tp-home-diagnostics__body">${details.map((line) => `<div>${line}</div>`).join('')}</div>
    `;

    if (level === 'error') {
      retryButton = document.createElement('button');
      retryButton.type = 'button';
      retryButton.className = 'tp-home-diagnostics__retry';
      retryButton.textContent = 'Retry';
      retryButton.addEventListener('click', () => {
        void ensureEmbedReady({ forceRemount: true });
      });
      panel.appendChild(retryButton);
    }
  }

  function clearDiagnostics() {
    if (!diagnosticsEl) return;
    retryButton = null;
    diagnosticsEl.hidden = true;
    diagnosticsEl.innerHTML = '';
  }

  function describeError(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  function validateSource(view: ViewKey) {
    const source = diagramSources[view];
    const diagram = parseDiagram(source);
    return {
      diagram,
      source,
      view,
      pillCount: diagram.pills.length,
      threadCount: diagram.threads.length,
    };
  }

  function setMenuOpen(nextOpen: boolean) {
    dropdown.dataset.open = nextOpen ? 'true' : 'false';
    trigger.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  }

  async function swapView(nextView: ViewKey) {
    const result = validateSource(nextView);

    if (!embed) {
      await ensureEmbedReady();
      if (!embed) return;
    }

    clearDiagnostics();
    root.dataset.transitionState = 'fading-out';
    await waitForAnimation(150);

    embed.update({ source: result.source });

    root.dataset.transitionState = 'fading-in';
    await waitForAnimation(200);
    root.dataset.transitionState = 'idle';
    setEmbedState('ready');
  }

  function applyView(nextView: string) {
    const resolvedView: ViewKey = nextView in labels ? (nextView as ViewKey) : 'overview';
    activeView = resolvedView;
    current.textContent = labels[activeView];

    for (const node of optionNodes) {
      const selected = node.dataset.view === activeView;
      node.classList.toggle('is-active', selected);
      node.setAttribute('aria-selected', selected ? 'true' : 'false');
    }

    setMenuOpen(false);

    void swapView(activeView).catch((error) => {
      console.error('[ThreadPilled] failed to load view', activeView, error);
      root.dataset.transitionState = 'idle';
      setDiagnostics('Could not load selected diagram view.', [
        `View: ${activeView}`,
        `Error: ${describeError(error)}`,
      ]);
    });
  }

  async function ensureEmbedReady(options: { forceRemount?: boolean } = {}) {
    setEmbedState('loading');
    root.dataset.transitionState = 'idle';

    let attempts = 0;
    while (attempts < 24 && root.clientWidth < 40) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      attempts += 1;
    }

    let validated;
    try {
      validated = validateSource(activeView);
      console.info('[ThreadPilled] initial validation passed', {
        view: validated.view,
        pills: validated.pillCount,
        threads: validated.threadCount,
        width: root.clientWidth,
      });
    } catch (error) {
      console.error('[ThreadPilled] initial validation failed', error);
      setDiagnostics('ThreadPilled source validation failed.', [
        `View: ${activeView}`,
        `Error: ${describeError(error)}`,
      ]);
      return;
    }

    if (options.forceRemount && embed) {
      embed.destroy();
      embed = null;
      diagnosticsEl = null;
      retryButton = null;
      clearDiagnostics();
    }

    if (!embed) {
      try {
        embed = new ThreadPilledVanillaEmbed(root, {
          source: validated.source,
          theme: {
            preset: 'dark',
            overrides: {
              bg: '#090b10',
              panelBg: '#0f141d',
              text: '#e8e9ed',
              textDim: '#93a0b4',
              accent: '#00e5a0',
            },
          },
          height: 560,
          showControls: false,
          showSourceToggle: false,
          showOpenInApp: false,
          accessibility: {
            ariaLabel: 'SwimSentry information flow diagram',
            reducedMotion: true,
          },
          layout: {
            density: 'spacious',
          },
          size: {
            fillContainer: true,
          },
          events: {
            onPillClick: (data) => {
              handlePillNavigation(data.pillId);
            },
          },
        });
        clearDiagnostics();
        setEmbedState('ready');
      } catch (error) {
        console.error('[ThreadPilled] mount failed', error);
        setDiagnostics('ThreadPilled mount failed.', [
          `View: ${activeView}`,
          `Width: ${root.clientWidth}px`,
          `Error: ${describeError(error)}`,
        ]);
      }
      return;
    }

    try {
      embed.update({
        source: validated.source,
        accessibility: {
          ariaLabel: 'SwimSentry information flow diagram',
          reducedMotion: true,
        },
        events: {
          onPillClick: (data) => {
            handlePillNavigation(data.pillId);
          },
        },
      });
      clearDiagnostics();
      setEmbedState('ready');
    } catch (error) {
      console.error('[ThreadPilled] reload failed', error);
      setDiagnostics('ThreadPilled reload failed.', [
        `View: ${activeView}`,
        `Error: ${describeError(error)}`,
      ]);
    }
  }

  trigger.addEventListener('click', () => {
    setMenuOpen(dropdown.dataset.open !== 'true');
  });

  for (const node of optionNodes) {
    node.addEventListener('click', () => {
      applyView(node.dataset.view ?? 'overview');
    });
  }

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Node)) return;
    if (!dropdown.contains(event.target)) setMenuOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenuOpen(false);
  });

  await ensureEmbedReady();

  window.addEventListener('load', () => {
    void ensureEmbedReady();
  });

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      void ensureEmbedReady();
    });
  } else {
    window.setTimeout(() => {
      void ensureEmbedReady();
    }, 120);
  }
}
