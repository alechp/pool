import { createSignal, Show } from 'solid-js';

export default function LoginForm() {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email(),
          password: password(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? 'Sign in failed. Check your credentials.');
        setLoading(false);
        return;
      }

      // Redirect to app on success
      window.location.href = '/';
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      <div>
        <label
          for="login-email"
          class="block font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary mb-1.5"
        >
          Email
        </label>
        <input
          id="login-email"
          type="email"
          required
          autocomplete="email"
          value={email()}
          onInput={(e) => setEmail(e.currentTarget.value)}
          placeholder="you@example.com"
          class="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active transition-colors"
        />
      </div>

      <div>
        <label
          for="login-password"
          class="block font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary mb-1.5"
        >
          Password
        </label>
        <input
          id="login-password"
          type="password"
          required
          autocomplete="current-password"
          value={password()}
          onInput={(e) => setPassword(e.currentTarget.value)}
          placeholder="Enter your password"
          class="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active transition-colors"
        />
      </div>

      <Show when={error()}>
        <div class="rounded-lg bg-accent-coral/10 border border-accent-coral/20 px-3 py-2 text-sm text-accent-coral">
          {error()}
        </div>
      </Show>

      <button
        type="submit"
        disabled={loading()}
        class="mt-1 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg-deep transition-colors hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading() ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
