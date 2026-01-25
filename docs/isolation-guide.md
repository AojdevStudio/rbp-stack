# RBP Isolation Guide

RBP Stack operates in **project-only isolation mode** by default. This means Claude Code sessions use only project-level configuration, ignoring global PAI settings.

## Why Isolation?

- **Simplicity**: RBP works without requiring PAI installation
- **Predictability**: No conflicts with global hooks or commands
- **Portability**: Projects can be shared without PAI dependencies

## What's Isolated

| Component | Isolated? | Notes |
|-----------|-----------|-------|
| Hooks | Yes | Only project `.claude/hooks/` loaded |
| Commands | Yes | Only project `.claude/commands/` loaded |
| Skills | Yes | Only project `.claude/skills/` loaded |
| Settings | Yes | Project settings.json takes precedence |

## Configuration

The isolation is configured in `.claude/settings.json`:

```json
{
  "_isolation": {
    "mode": "project-only",
    "description": "Global ~/.claude hooks, commands, and skills are not used."
  },
  "includeColocatedProjects": false
}
```

## Project Hooks

RBP includes minimal hooks for beads integration:

- `session-start.ts` - Loads beads context at session start
- `session-end.ts` - Syncs beads and checks for uncommitted changes

## Opting Into PAI Integration (Future)

To enable PAI features in an RBP project:

1. Remove the `_isolation` block from settings.json
2. Set `includeColocatedProjects: true`
3. Or reinstall with: `./rbp/install.sh --with-pai` (future feature)

## Troubleshooting

**Q: My global hooks aren't running**
A: This is expected. RBP uses project-only isolation.

**Q: How do I use PAI skills with RBP?**
A: Copy desired skills to project `.claude/skills/` or disable isolation.

**Q: Beads context not loading?**
A: Ensure `.beads/` directory exists and `bd` CLI is installed.
