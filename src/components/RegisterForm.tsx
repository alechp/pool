import { createSignal, Show } from 'solid-js';

export default function RegisterForm() {
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError('');

    if (password() !== confirmPassword()) {
      setError('Passwords do not match.');
      return;
    }

    if (password().length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name(),
          email: email(),
          password: password(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(
          data?.message ?? data?.error?.message ?? 'Registration failed. Please try again.',
        );
        setLoading(false);
        return;
      }

      // Redirect to login on success
      window.location.href = '/login?registered=1';
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      <div>
        <label
          for="register-name"
          class="block font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary mb-1.5"
        >
          Name
        </label>
        <input
          id="register-name"
          type="text"
          required
          autocomplete="name"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder="Your name"
          class="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active transition-colors"
        />
      </div>

      <div>
        <label
          for="register-email"
          class="block font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary mb-1.5"
        >
          Email
        </label>
        <input
          id="register-email"
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
          for="register-password"
          class="block font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary mb-1.5"
        >
          Password
        </label>
        <input
          id="register-password"
          type="password"
          required
          autocomplete="new-password"
          value={password()}
          onInput={(e) => setPassword(e.currentTarget.value)}
          placeholder="At least 8 characters"
          class="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active transition-colors"
        />
      </div>

      <div>
        <label
          for="register-confirm"
          class="block font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary mb-1.5"
        >
          Confirm Password
        </label>
        <input
          id="register-confirm"
          type="password"
          required
          autocomplete="new-password"
          value={confirmPassword()}
          onInput={(e) => setConfirmPassword(e.currentTarget.value)}
          placeholder="Repeat your password"
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
        {loading() ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
}
