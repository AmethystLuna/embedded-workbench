/**
 * embedded-workbench — browser half: the gate-injection switch on the dsh Web
 * client's Plugins page.
 *
 * The Plugins page (`@deepseek-ai/dsh-client-ui-plugin-manager`) owns the
 * sidebar **Plugins** entry and declares the slots a bundle's own configuration
 * registers into. This module contributes one `plugins.bundle.config` entry,
 * keyed by this package's npm name, so the switch renders on
 * embedded-workbench's own page between its description and its rows.
 *
 * Why the switch writes through `configForms` rather than reaching for the
 * profile file: dsh's settings service exposes only the Config fields declared
 * `.volatile()`, and it rejects a write to any other path. `enabled` is such a
 * field (see `src/index.ts`), so flipping the switch is an ordinary
 * revision-fenced settings write that the running Host picks up in place — the
 * injection there re-reads the reference on every model step.
 *
 * Shape: this is a prebuilt module-system bundle, not a source module. It calls
 * `window.__ModuleLoader__.load({ id, factory })` with this package's resolved
 * npm name, and `factory` returns the cordis plugin face. Only the client
 * baseline is requested (`react` and
 * `@deepseek-ai/dsh-client-ui-primitives`); every other capability arrives
 * through cordis `inject`. `scripts/build-client.mjs` publishes this file
 * verbatim as `lib/client.js`.
 *
 * @module dsh-embedded-workbench/client
 */

window.__ModuleLoader__.load({
  id: 'dsh-embedded-workbench',
  factory: (require) => {
    const React = require('react')
    // The host's Switch and Button, vendored. A plain-JS client bundle must not
    // require a Harness Client package: it changes without notice, we get no type
    // check, and a throw blanks this slot entry. Markup, classes, token usage and
    // the aria behaviour follow the host primitive; classes carry our own prefix.
    const CONTROLS_CSS = [
      '.ew-switch { box-sizing: border-box; position: relative; flex: 0 0 auto; width: 36px; height: 20px; padding: 2px; border: 0; border-radius: 999px; corner-shape: round; background: var(--dsw-alias-border-l3); cursor: pointer; }',
      ".ew-switch[aria-checked='true'] { background: var(--dsw-alias-brand-primary); }",
      '.ew-switch:disabled { cursor: default; opacity: 0.5; }',
      '.ew-switch:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }',
      '.ew-switch-thumb { display: block; width: 16px; height: 16px; border-radius: 50%; corner-shape: round; background: var(--dsw-alias-label-primary-foreground); transition: transform 120ms ease; }',
      ".ew-switch[aria-checked='false'] .ew-switch-thumb { background: var(--dsw-alias-switch-thumb); }",
      ".ew-switch[aria-checked='true'] .ew-switch-thumb { transform: translateX(16px); }",
      '.ew-btn { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 4px; border: none; border-radius: var(--dsw-radius-md); cursor: pointer; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary); background: transparent; padding: 0 14px; }',
      '.ew-btn:disabled { cursor: not-allowed; opacity: 0.4; }',
      '.ew-btn-sm { height: 28px; font-size: 12px; line-height: 18px; padding: 0 10px; border-radius: var(--dsw-radius-sm); }',
      '.ew-btn-outline { border: 0.5px solid var(--dsw-alias-border-l3); background: transparent; }',
      '.ew-btn-outline:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }',
    ].join('\n')

    /** Rendered inside the component tree, so unmounting removes the styles. */
    function Controls() {
      return React.createElement('style', null, CONTROLS_CSS)
    }

    function Switch(props) {
      return React.createElement(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': props.checked === true,
          'aria-label': props.label,
          className: 'ew-switch',
          disabled: props.disabled === true,
          onClick: () => {
            if (props.disabled !== true) props.onChange(!(props.checked === true))
          },
        },
        React.createElement('span', { className: 'ew-switch-thumb' }),
      )
    }

    Switch.displayName = 'dsh-embedded-workbench:Switch'
    Button.displayName = 'dsh-embedded-workbench:Button'

    function Button(props) {
      const classes = ['ew-btn']
      if (props.size === 'sm') classes.push('ew-btn-sm')
      if (props.variant === 'outline') classes.push('ew-btn-outline')
      return React.createElement(
        'button',
        { type: 'button', className: classes.join(' '), disabled: props.disabled === true, onClick: props.onClick },
        props.children,
      )
    }

    /** Settings namespace: the Loader entry id this bundle's patch declares. */
    const NS = 'embedded-workbench'
    /** `plugins.bundle.config` key: the bundle's npm package name. */
    const PACKAGE = 'dsh-embedded-workbench'
    /** This page's dictionary namespace. */
    const LOCALE_NS = 'embedded-workbench.plugins'
    /** The Config field the switch writes inside the namespace's section. */
    const FIELD = 'enabled'

    /** English copy. */
    const en = {
      title: 'Gate injection',
      label: 'Inject the gate text',
      hint: 'Folds the Plan Verification Gate and the context-budget rule into the first model step of every session. Turning it off leaves all eight skills registered — only the injected text is dropped.',
      overridden: 'Overridden',
      reset: 'Reset to default',
      readOnly: 'This deployment stores settings read-only.',
      unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
      saveFailed: 'The deployment did not accept that value; the switch shows what is stored.',
    }
    /** Simplified Chinese copy. */
    const zh = {
      title: 'Gate 注入',
      label: '注入 gate 文本',
      hint: '把 Plan Verification Gate 与上下文预算规则折进每个会话的第一个模型步。关掉后 8 个技能仍然注册，只是不再注入那段提示文本。',
      overridden: '已覆盖',
      reset: '恢复默认',
      readOnly: '本部署的设置为只读。',
      unavailable: '该插件当前未加载，暂时无法配置。',
      saveFailed: '本部署没有接受这个值，开关显示的是已存下的状态。',
    }

    /** Required cordis services. */
    const inject = ['slots', 'locale', 'configForms']

    const GROUP = { display: 'flex', flexDirection: 'column', gap: '8px' }
    const TITLE = { margin: 0, fontSize: '14px', fontWeight: '500', lineHeight: '22px' }
    const ROW = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }
    const LABEL = { fontSize: '13px', lineHeight: '20px' }
    const NOTE = { margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' }
    const FAILED = { margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary)' }

    /**
     * Whether a settings-layer value carries this field, which is what marks it
     * overridden: an override equal to the default is still an override.
     * @param layer - the raw user layer the form snapshot carries.
     * @returns whether the layer holds the field.
     */
    function carries(layer) {
      return layer !== null && typeof layer === 'object' && Object.prototype.hasOwnProperty.call(layer, FIELD)
    }

    /**
     * Render the gate-injection switch, or the note saying why it cannot render.
     * @param props - the page's `t` seat, the bound form snapshot hook, and the write actions.
     * @returns the body of this bundle's configuration section.
     */
    function InjectionCard(props) {
      const t = props.t
      const state = props.useInjectionForm((snapshot) => snapshot)
      const [pending, setPending] = React.useState(false)
      const [failed, setFailed] = React.useState(false)

      /** Run one settings write and report a refusal or a transport failure. */
      const write = (run) => {
        setPending(true)
        setFailed(false)
        Promise.resolve(run()).then(
          (accepted) => {
            setPending(false)
            setFailed(accepted === false)
          },
          () => {
            setPending(false)
            setFailed(true)
          },
        )
      }

      if (state.status !== 'ready') {
        return React.createElement('p', { style: NOTE }, t('unavailable'))
      }

      const section = state.value !== null && typeof state.value === 'object' ? state.value : {}
      // The schema default is `true`; only an explicit false means off.
      const checked = section[FIELD] !== false
      const overridden = carries(state.user)
      const locked = state.writable !== true || pending

      const children = [
        React.createElement(Controls, { key: 'styles' }),
        React.createElement('h4', { key: 'title', style: TITLE }, t('title')),
        React.createElement('div', { key: 'row', style: ROW }, [
          React.createElement('span', { key: 'label', style: LABEL }, t('label')),
          React.createElement(Switch, {
            key: 'switch',
            checked,
            disabled: locked,
            label: t('label'),
            onChange: (next) => write(() => props.setEnabled(next)),
          }),
        ]),
        React.createElement('p', { key: 'hint', style: NOTE }, state.writable === true ? t('hint') : t('readOnly')),
      ]

      if (overridden) {
        children.push(
          React.createElement('div', { key: 'overridden', style: ROW }, [
            React.createElement('span', { key: 'badge', style: NOTE }, t('overridden')),
            React.createElement(
              Button,
              {
                key: 'reset',
                variant: 'outline',
                size: 'sm',
                disabled: locked,
                onClick: () => write(() => props.resetEnabled()),
              },
              t('reset'),
            ),
          ]),
        )
      }

      if (failed) {
        children.push(React.createElement('p', { key: 'failed', style: FAILED, role: 'alert' }, t('saveFailed')))
      }

      return React.createElement('div', { style: GROUP }, children)
    }

    /**
     * Mount the switch while the Host serves embedded-workbench's settings
     * namespace.
     * @param ctx - the browser plugin context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'dsh-embedded-workbench: dictionaries')
      // `whileServed` is the registration barrier that keeps this page alive only
      // while the Host serves the namespace. Hosts predating it (measured: dsh
      // 0.1.5-rc.3 and 0.1.6-alpha.2) have no live settings field to offer at all,
      // so there is nothing to register — and calling it there would throw during
      // this plugin's own activation, which the Web boot audit then reports as a
      // failed client entry. Degrade to no page instead.
      if (typeof ctx.configForms.whileServed !== 'function') return
      // The page renders the section only for a bundle whose package name is in
      // its configuration ledger, and the ledger follows this registration. The
      // registration in turn waits for the namespace to be served, so a profile
      // whose embedded-workbench row is switched off shows no trace of the
      // switch.
      ctx.effect(
        () =>
          ctx.configForms.whileServed([NS], () => {
            const form = ctx.configForms.get(NS)
            const source = {
              getSnapshot: () => form.getSnapshot(),
              subscribe: (listener) => form.subscribe(listener),
            }
            return ctx.slots.inject('plugins.bundle.config', () =>
              ctx.slots.register(
                {
                  name: 'plugins.bundle.config',
                  key: PACKAGE,
                  locale: LOCALE_NS,
                  inject: () => ({
                    hooks: { injectionForm: source },
                    setEnabled: (next) => form.set(FIELD, next),
                    resetEnabled: () => form.unset(FIELD),
                  }),
                },
                InjectionCard,
              ),
            )
          }),
        'dsh-embedded-workbench: gate-injection switch',
      )
    }

    return { inject, apply }
  },
})
