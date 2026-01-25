#!/usr/bin/env bash
# RBP Stack Installer
# Usage: ./install.sh [target-directory]
#
# Installs the RBP Stack (Ralph + Beads + PAI) into a project directory.
# This copies scripts, commands, and templates needed for autonomous execution.

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-.}"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
VERSION=$(cat "$SCRIPT_DIR/VERSION" 2>/dev/null || echo "2.0.0")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_banner() {
  echo -e "${CYAN}"
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║              RBP Stack Installer v${VERSION}                     ║"
  echo "║         Ralph + Beads + PAI Integration                   ║"
  echo "╚═══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

print_step() {
  echo -e "${YELLOW}→ $1${NC}"
}

print_success() {
  echo -e "${GREEN}  ✓ $1${NC}"
}

print_error() {
  echo -e "${RED}  ✗ $1${NC}"
}

# Step 1: Check prerequisites
check_prerequisites() {
  print_step "Checking prerequisites..."

  local missing=()

  if ! command -v bd &>/dev/null; then
    missing+=("bd (beads) - install with: brew install steveyegge/beads/bd")
  else
    print_success "bd (beads) installed"
  fi

  if ! command -v bun &>/dev/null; then
    missing+=("bun - install with: curl -fsSL https://bun.sh/install | bash")
  else
    print_success "bun installed"
  fi

  if ! command -v claude &>/dev/null; then
    missing+=("claude CLI - install from: https://claude.ai/download")
  else
    print_success "claude CLI installed"
  fi

  if [ ${#missing[@]} -gt 0 ]; then
    echo ""
    print_error "Missing prerequisites:"
    for item in "${missing[@]}"; do
      echo -e "    ${RED}- $item${NC}"
    done
    echo ""
    echo -e "${YELLOW}Install missing prerequisites and run installer again.${NC}"
    exit 1
  fi

  # Check for PAI Observability (optional but recommended)
  echo ""
  print_step "Checking optional dependencies..."

  if [ -f "$HOME/.claude/observability/manage.sh" ]; then
    print_success "PAI Observability found"

    # Check if it's running
    if curl -s http://localhost:4000/health 2>/dev/null | grep -q "ok"; then
      print_success "Observability dashboard is running at http://localhost:5172"
    else
      echo -e "  ${YELLOW}Observability installed but not running${NC}"
      echo -e "  ${CYAN}Start with: ~/.claude/observability/manage.sh start${NC}"
    fi
  else
    echo -e "  ${YELLOW}PAI Observability not found - observability features will be limited${NC}"
    echo -e "  ${YELLOW}Install PAI for real-time monitoring:${NC}"
    echo -e "  ${CYAN}https://github.com/danielmiessler/Personal_AI_Infrastructure.git${NC}"
    echo ""
    read -p "  Continue without PAI? (y/n): " choice
    if [ "$choice" != "y" ] && [ "$choice" != "Y" ]; then
      echo -e "${YELLOW}Installation cancelled. Install PAI first.${NC}"
      exit 1
    fi
  fi

  echo ""
}

# Step 2: Build TypeScript
build_typescript() {
  print_step "Building TypeScript CLI..."

  cd "$SCRIPT_DIR"

  # Install dependencies
  if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    bun install --silent
  fi

  # Build the TypeScript
  echo "  Compiling TypeScript..."
  bun run build

  if [ -f "$SCRIPT_DIR/lib/dist/index.js" ]; then
    print_success "TypeScript CLI built successfully"
  else
    print_error "Failed to build TypeScript CLI"
    exit 1
  fi

  cd - > /dev/null
  echo ""
}

# Step 3: Install scripts
install_scripts() {
  print_step "Installing scripts to $TARGET_DIR/scripts/rbp/..."

  mkdir -p "$TARGET_DIR/scripts/rbp"

  # Copy TypeScript CLI and wrapper
  cp "$SCRIPT_DIR/ralph.sh" "$TARGET_DIR/scripts/rbp/"
  mkdir -p "$TARGET_DIR/scripts/rbp/lib/dist"
  cp "$SCRIPT_DIR/lib/dist/index.js" "$TARGET_DIR/scripts/rbp/lib/dist/"

  # Copy prompt template
  cp "$SCRIPT_DIR/scripts/promptv3.md" "$TARGET_DIR/scripts/rbp/"

  # Make wrapper executable
  chmod +x "$TARGET_DIR/scripts/rbp/"*.sh

  print_success "TypeScript CLI installed"
  echo ""
}

# Step 4: Install commands
install_commands() {
  print_step "Installing slash commands to $TARGET_DIR/.claude/commands/..."

  mkdir -p "$TARGET_DIR/.claude/commands/rbp"

  # Copy RBP command files
  cp "$SCRIPT_DIR/commands/rbp/"*.md "$TARGET_DIR/.claude/commands/rbp/"

  # Copy bundled quick-plan command (if not already present)
  if [ -f "$SCRIPT_DIR/commands/quick-plan.md" ]; then
    if [ ! -f "$TARGET_DIR/.claude/commands/quick-plan.md" ]; then
      cp "$SCRIPT_DIR/commands/quick-plan.md" "$TARGET_DIR/.claude/commands/"
      print_success "quick-plan command installed"
    else
      print_success "quick-plan command already exists (skipped)"
    fi
  fi

  print_success "Slash commands installed"
  echo ""
}

# Step 5: Install skills
install_skills() {
  print_step "Installing skills to $TARGET_DIR/.claude/skills/rbp/..."

  local skills_src="$SCRIPT_DIR/templates/skills"
  local skills_dst="$TARGET_DIR/.claude/skills/rbp"

  if [ -d "$skills_src" ] && [ "$(ls -A "$skills_src" 2>/dev/null)" ]; then
    mkdir -p "$skills_dst"
    # Copy skill directories (each skill is a directory with SKILL.md inside)
    for skill_dir in "$skills_src"/*/; do
      if [ -d "$skill_dir" ]; then
        cp -r "$skill_dir" "$skills_dst/"
      fi
    done
    print_success "Skills installed"
  else
    echo -e "  ${YELLOW}No bundled skills found (optional)${NC}"
  fi

  echo ""
}

# Step 6: Setup hooks and settings
install_hooks() {
  print_step "Configuring Claude Code hooks and settings..."

  local settings_file="$TARGET_DIR/.claude/settings.json"
  local hooks_src="$SCRIPT_DIR/templates/hooks"
  local hooks_dst="$TARGET_DIR/.claude/hooks"

  mkdir -p "$TARGET_DIR/.claude"

  # Copy hook files if they exist
  if [ -d "$hooks_src" ] && [ "$(ls -A "$hooks_src" 2>/dev/null)" ]; then
    mkdir -p "$hooks_dst"
    cp "$hooks_src"/*.ts "$hooks_dst/" 2>/dev/null || true
    print_success "Hook files installed to .claude/hooks/"
  fi

  # Handle settings.json
  if [ -f "$settings_file" ]; then
    # Check if already using RBP isolation settings
    if grep -q "project-only" "$settings_file" 2>/dev/null; then
      print_success "RBP isolation settings already configured"
      echo ""
      return
    fi

    # Backup existing settings
    cp "$settings_file" "$settings_file.bak"
    print_success "Backed up existing settings.json"

    echo -e "${YELLOW}  Note: Existing settings backed up. Review for manual merge if needed.${NC}"
  fi

  # Create/overwrite settings.json from template (isolation mode)
  if [ -f "$SCRIPT_DIR/templates/settings.json" ]; then
    cp "$SCRIPT_DIR/templates/settings.json" "$settings_file"
    print_success "Created settings.json with RBP isolation mode"
  else
    echo '{}' > "$settings_file"
    echo -e "${YELLOW}  Created empty settings.json - configure manually${NC}"
  fi

  echo ""
}

# Step 7: Initialize beads if needed
init_beads() {
  print_step "Checking beads initialization..."

  if [ -d "$TARGET_DIR/.beads" ]; then
    print_success "Beads already initialized"
  else
    echo -e "  Initializing beads..."
    (cd "$TARGET_DIR" && bd init)
    print_success "Beads initialized"
  fi

  # Install git hooks for auto-sync (recommended by beads docs)
  echo -e "  Installing beads git hooks..."
  (cd "$TARGET_DIR" && bd hooks install 2>/dev/null) && \
    print_success "Beads git hooks installed" || \
    echo -e "  ${YELLOW}Note: Could not install hooks (may require newer beads version)${NC}"

  echo ""
}

# Step 8: Create config if not exists
create_config() {
  print_step "Setting up configuration..."

  local config_file="$TARGET_DIR/rbp-config.yaml"

  if [ -f "$config_file" ]; then
    print_success "rbp-config.yaml already exists"
  else
    if [ -f "$SCRIPT_DIR/templates/rbp-config.yaml" ]; then
      cp "$SCRIPT_DIR/templates/rbp-config.yaml" "$config_file"
      print_success "Created rbp-config.yaml from template"
      echo -e "${YELLOW}  Review and customize the configuration for your project.${NC}"
    else
      echo -e "${YELLOW}  No template found - create rbp-config.yaml manually${NC}"
    fi
  fi

  echo ""
}

# Step 9: Copy validator
copy_validator() {
  print_step "Installing validator..."

  cp "$SCRIPT_DIR/validate.sh" "$TARGET_DIR/scripts/rbp/"
  chmod +x "$TARGET_DIR/scripts/rbp/validate.sh"

  print_success "Validator installed"
  echo ""
}

# Print summary
print_summary() {
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}RBP Stack Installation Complete${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo ""
  echo "Installed to: $TARGET_DIR"
  echo ""
  echo -e "${CYAN}Isolation Mode: project-only (global PAI hooks disabled)${NC}"
  echo "  - Skills: scoped to .claude/skills/rbp/"
  echo "  - Hooks: scoped to .claude/hooks/"
  echo "  - Settings: scoped to .claude/settings.json"
  echo ""

  # Check if skills were installed
  if [ -d "$TARGET_DIR/.claude/skills/rbp" ] && [ "$(ls -A "$TARGET_DIR/.claude/skills/rbp" 2>/dev/null)" ]; then
    echo -e "${GREEN}Bundled skills installed to .claude/skills/rbp/${NC}"
    echo ""
  fi

  echo "Next steps:"
  echo "  1. Review configuration: $TARGET_DIR/rbp-config.yaml"
  echo "  2. Run validation: /rbp:validate (in Claude Code)"
  echo ""
  echo -e "${GREEN}Start autonomous execution (CLI only):${NC}"
  echo "  ./scripts/rbp/ralph.sh start"
  echo ""
  echo "  This will:"
  echo "    - Detect project type (BMAD or Quick-plan)"
  echo "    - Auto-create stories from epics (headless)"
  echo "    - Parse to beads tasks"
  echo "    - Run execution loop until complete"
  echo ""
  echo -e "${YELLOW}Ralph CLI Commands:${NC}"
  echo "    bun ./scripts/rbp/lib/dist/index.js run            # Run execution loop"
  echo "    bun ./scripts/rbp/lib/dist/index.js status         # Show progress"
  echo "    bun ./scripts/rbp/lib/dist/index.js close <id>     # Close task with tests"
  echo "    bun ./scripts/rbp/lib/dist/index.js exec-spec <f>  # Execute spec file"
  echo ""
  echo "    Or use the wrapper script:"
  echo "    ./scripts/rbp/ralph.sh start          # Auto-detect and run"
  echo "    ./scripts/rbp/ralph.sh run --beads    # Run beads workflow"
  echo "    ./scripts/rbp/ralph.sh run --bmad     # Run BMAD workflow"
  echo "    ./scripts/rbp/ralph.sh status         # Show progress"
  echo ""
  echo -e "${YELLOW}Slash Commands (read-only, use in Claude Code):${NC}"
  echo "    /rbp:status      Show progress and task state"
  echo "    /rbp:validate    Validate installation"
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
}

# Main installation flow
main() {
  print_banner

  echo "Installing RBP Stack to: $TARGET_DIR"
  echo ""

  check_prerequisites
  build_typescript
  install_scripts
  install_commands
  install_skills
  install_hooks
  init_beads
  create_config
  copy_validator
  print_summary
}

# Handle help argument
case "${1:-}" in
  --help|-h)
    echo "RBP Stack Installer"
    echo ""
    echo "Usage: ./install.sh [target-directory] [options]"
    echo ""
    echo "Arguments:"
    echo "  target-directory  Directory to install RBP Stack (default: current directory)"
    echo ""
    echo "Options:"
    echo "  --with-pai        Enable PAI integration (future feature)"
    echo ""
    echo "This installer will:"
    echo "  - Check prerequisites (bd, bun, claude)"
    echo "  - Copy scripts to scripts/rbp/"
    echo "  - Copy slash commands to .claude/commands/rbp/"
    echo "  - Configure Claude Code hooks"
    echo "  - Initialize beads if needed"
    echo "  - Create rbp-config.yaml"
    exit 0
    ;;
  --with-pai)
    echo -e "${YELLOW}Note: --with-pai is reserved for future PAI integration${NC}"
    shift
    main
    ;;
  *)
    main
    ;;
esac
