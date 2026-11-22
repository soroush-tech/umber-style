# AGENTS.md

Guidance for coding agents working on this app.

<!-- soroush:begin skills hash=f5fd9bcc -->
## Skills

This app's rules for coding agents are skills: folders holding a `SKILL.md`. Load the one that
fits the task before you start.

- [component-tree](docs/skills/component-tree/SKILL.md): This app's component tree - its folders, what each holds, the files a component starts with - and where a new component goes. Load before creating, moving or extracting a component or a file.
- `soroush-design-system`, `wcag`: the design system's house style and accessibility rules,
  installed into `.agents/skills/` with `npx skills add soroush-tech/design-system`.

Install the app's own skills for your agent with `npx skills add ./docs/skills`.
<!-- soroush:end skills -->
