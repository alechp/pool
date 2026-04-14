# Component Interaction Specification

## Goal

Every visible control in SwimSentry must behave like a real component, not decorative chrome.

This spec exists to prevent three recurring failures:

1. dead dropdowns or tabs that render but do not change state
2. styled inputs that are not actually editable
3. buttons with no hover, focus, active, disabled, or loading behavior

The implementation target is Astro SSR plus islands. Favor native HTML semantics first, then headless behavior. Preline headless patterns can be used where they strengthen accessible menus, disclosures, tabs, dropdowns, and dialogs without forcing heavy client-side wrappers.

## Core Rules

### Real semantics first

- Use native `<button>`, `<a>`, `<input>`, `<textarea>`, `<select>`, `<details>`, and `<dialog>` where possible.
- Do not use `div` or `span` as clickable controls unless there is a documented accessibility reason and keyboard behavior is added.
- If a control is visible, it must either mutate state, navigate, submit, expand, filter, or explicitly show a disabled state with a reason.

### Interaction states are required

Every interactive component must define:

- resting
- hover
- focus-visible
- active / pressed
- disabled
- loading, if the action triggers async work

### Inputs must be truly editable

- Inputs shown as examples in product UI should use real `<input>` or `<textarea>` elements unless the screen is a locked demo mode.
- If a control is a simulation, label it as a simulation and keep it visually distinct from production inputs.
- Placeholder-only boxes styled as inputs are not acceptable in live workflows.

### State must be observable

- Dropdowns must visibly open and close.
- Changing a selection must produce a visible downstream effect.
- Demo controls must indicate whether the user is in simulated mode or live mode.
- Disabled actions must explain why they are disabled, either inline or through nearby helper text.

## Component Contracts

## Buttons

### Required behavior

- Must use `<button>` for in-place actions and `<a>` for navigation.
- Must expose `disabled` when the action cannot run.
- Must show a pointer cursor only when actionable.
- Async buttons must show loading text, icon, or spinner and prevent duplicate submission.

### Required visual states

- Resting: stable background, border, and text contrast.
- Hover: slight lift or color shift.
- Focus-visible: clear ring, not color-only.
- Active: compressed or darker state.
- Disabled: lower contrast and clear non-actionable state.

### Acceptance criteria

- Hover is visible on desktop.
- Keyboard focus is obvious without relying on browser default outline alone.
- Enter/Space trigger the same behavior as click for buttons.

## Text Inputs

### Required behavior

- Must use controlled values for island components that persist or validate state.
- Must allow editing, deletion, selection, paste, and keyboard navigation.
- Placeholder text cannot be the only source of context if the field is important.
- If the field is read-only, explicitly mark it `readonly` and label it as generated or demo content.

### Required visual states

- resting border
- hover border shift
- focus-visible ring
- disabled state
- error state, where validation exists

### Acceptance criteria

- User can type, delete, paste, and tab into the control.
- Selection state is preserved unless the app intentionally clears it after submit.
- Inputs in demos are either truly editable or clearly marked simulated.

## Selects and Dropdown Menus

### Required behavior

- If there are fewer than roughly 6 stable choices and native semantics work, prefer `<select>`.
- Use a headless menu or listbox pattern only when richer rendering is necessary.
- The trigger must open a menu or list immediately.
- Choosing an option must update UI state in the same view.
- Escape closes the menu. Outside click closes the menu.
- Arrow keys and Enter must work for custom listboxes.

### Preline guidance

- Preline headless menu, select, disclosure, and tabs patterns are acceptable when we need richer dropdowns than native HTML provides.
- If Preline is used, keep the behavior layer isolated in a wrapper component so the visual styling remains SwimSentry-specific.
- Do not import a heavy JS bundle for behavior that native HTML already solves.

### Acceptance criteria

- No visible dropdown may be inert.
- The current selection must be readable without opening the menu.
- Menu positioning must not block the selected state from being understood.

## Tabs

### Required behavior

- The active tab must be visually distinct.
- Changing tabs must switch visible content in the same frame.
- Keyboard navigation should support ArrowLeft/ArrowRight for custom tablists.
- Tabs must never look selectable if the content does not change.

### Acceptance criteria

- Screen title or panel heading changes with the tab.
- Deep-linkable tabs should sync to query params or route segments.

## Demo Mode

### Required behavior

- Demo mode must be clearly labeled as guided or simulated.
- Simulated typing, clicking, and page transitions must be visually obvious.
- The handoff from demo to live mode must be explicit.

### Acceptance criteria

- Users can replay the demo.
- Users can interrupt the demo and switch to live mode.
- Demo-only controls cannot be mistaken for production controls without a label.

## Cards and Clickable Panels

### Required behavior

- Entire-card click areas are acceptable only when the card is singular in purpose.
- If a card contains multiple actions, expose individual buttons or links instead of making the whole card clickable.
- Hover states must not imply clickability for static informational cards.

## Hover Panels, Popovers, and Flyouts

### Required behavior

- The trigger area must be narrow and intentional.
- The panel must remain open while the cursor is inside either the trigger or panel.
- Close should use delayed timeout after pointer exit.
- Keyboard focus must also support opening and reaching links inside the panel.

### Acceptance criteria

- A user can move from trigger to popup without losing it.
- Hover flyouts must not be attached to large noisy parent regions.

## Home Page Requirements

### Hero diagram

- The top-right selector must be a real control owned by SwimSentry, not opaque third-party chrome.
- The selected view must update the diagram immediately.
- Third-party embedded toolbars should be hidden when they expose dead or unclear affordances.

### Inline advisor

- The `Ask AI` input must always be a real editable input.
- Demo mode must present itself as a walkthrough, not a live conversation thread.
- Primary actions must have visible hover and focus treatment.

## Build and BOM Requirements

### Build

- Quantity controls, build save actions, edit, and fork must be explicit and recoverable.
- Saved state must survive refresh and restart when the workflow claims persistence.

### BOM

- Global generation controls must affect the whole table.
- Row-level supplier overrides must preserve provenance:
  - `default`
  - `filter`
  - `manual`
- The current strategy and saved state must be visible without guessing.

## Styling Tokens

These are behavior-oriented expectations, not a fixed visual redesign.

- Border radius:
  - Inputs and buttons: `12px` to `16px`
  - Panels: `20px` to `32px`
- Motion:
  - Hover: `120ms` to `180ms`
  - Open/close: `150ms` to `220ms`
- Focus:
  - Use ring plus border shift
  - Minimum visible ring contrast against dark surfaces
- Shadows:
  - Resting: subtle
  - Hover: slightly elevated
  - Active: reduced shadow

## Implementation Checklist

- Replace decorative faux controls with semantic HTML controls.
- Audit all visible inputs and convert non-editable shells to real inputs or clearly mark them simulated.
- Add hover and focus-visible states to all primary and secondary buttons.
- Hide third-party embedded chrome when it cannot be controlled from the host app.
- Prefer native select for small stable choice sets.
- Use headless menu/listbox only when option content needs custom layout.
- Keep behavior wrappers small and reusable.

## Immediate Application In This Repo

### Required now

- Home hero top-right selector must control the ThreadPilled view.
- Home advisor primary tabs and CTAs must expose hover and focus states.
- Any input shown on a live page must be editable unless explicitly marked as demo-only.

### Recommended next audit

- `src/components/HomeAdvisor.tsx`
- `src/components/ChatSidebar.tsx`
- `src/components/Dropdown.tsx`
- `src/components/BomWorkspace.tsx`
- `src/components/BuildReview.tsx`
- `src/components/PartDetailRow.tsx`

## Definition of Done

A component is done only if:

1. it uses the correct semantic element
2. it changes state or navigates when activated
3. it supports keyboard interaction where expected
4. it exposes hover, focus, active, and disabled states
5. it is clearly live, disabled, or simulated
6. its state change is visible to the user
