import type { Component, JSX } from 'solid-js';

interface Props {
  content: string;
  class?: string;
}

function renderInline(text: string): JSX.Element[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);

  return tokens.map((token) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong class="font-semibold text-text-primary">{token.slice(2, -2)}</strong>;
    }

    if (token.startsWith('`') && token.endsWith('`')) {
      return <code class="rounded bg-white/6 px-1.5 py-0.5 font-mono text-[12px] text-accent">{token.slice(1, -1)}</code>;
    }

    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a href={linkMatch[2]} class="text-accent underline decoration-accent/45 underline-offset-3" target="_blank" rel="noreferrer">
          {linkMatch[1]}
        </a>
      );
    }

    return <>{token}</>;
  });
}

const MarkdownMessage: Component<Props> = (props) => {
  const lines = props.content.split('\n');
  const blocks: JSX.Element[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let ordered: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p class="leading-7 text-[14px] text-text-secondary">
        {renderInline(paragraph.join(' '))}
      </p>
    );
    paragraph = [];
  };

  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul class="space-y-2 pl-1">
        {bullets.map((item) => (
          <li class="flex gap-2 text-[14px] leading-6 text-text-secondary">
            <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-accent/85" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };

  const flushOrdered = () => {
    if (!ordered.length) return;
    blocks.push(
      <ol class="space-y-2 pl-1">
        {ordered.map((item, index) => (
          <li class="flex gap-2 text-[14px] leading-6 text-text-secondary">
            <span class="flex h-5 min-w-5 items-center justify-center rounded-full border border-accent/25 bg-accent/8 font-mono text-[11px] text-accent">
              {index + 1}
            </span>
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ol>
    );
    ordered = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushBullets();
      flushOrdered();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushBullets();
      flushOrdered();
      const level = heading[1].length;
      const cls =
        level === 1
          ? 'text-[18px] font-semibold tracking-tight text-text-primary'
          : level === 2
          ? 'text-[15px] font-semibold uppercase tracking-[0.08em] text-accent'
          : 'text-[14px] font-semibold text-text-primary';
      blocks.push(<div class={cls}>{renderInline(heading[2])}</div>);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      flushOrdered();
      bullets.push(bullet[1]);
      continue;
    }

    const orderedItem = line.match(/^\d+\.\s+(.*)$/);
    if (orderedItem) {
      flushParagraph();
      flushBullets();
      ordered.push(orderedItem[1]);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushBullets();
  flushOrdered();

  return <div class={`space-y-3 ${props.class ?? ''}`}>{blocks}</div>;
};

export default MarkdownMessage;
