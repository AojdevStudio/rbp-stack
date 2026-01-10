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

  if [ -d "$HOME/.claude/skills/Observability" ]; then
    print_success "PAI Observability found (real-time dashboard available)"
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

# Step 2: Install scripts
install_scripts() {
  print_step "Installing scripts to $TARGET_DIR/scripts/rbp/..."

  mkdir -p "$TARGET_DIR/scripts/rbp"

  # Copy all scripts
  cp "$SCRIPT_DIR/scripts/ralph.sh" "$TARGET_DIR/scripts/rbp/"
  cp "$SCRIPT_DIR/scripts/prompt.md" "$TARGET_DIR/scripts/rbp/"
  cp "$SCRIPT_DIR/scripts/close-with-proof.sh" "$TARGET_DIR/scripts/rbp/"
  cp "$SCRIPT_DIR/scripts/sequencer.sh" "$TARGET_DIR/scripts/rbp/"
  cp "$SCRIPT_DIR/scripts/parse-story-to-beads.sh" "$TARGET_DIR/scripts/rbp/"
  cp "$SCRIPT_DIR/scripts/show-active-task.sh" "$TARGET_DIR/scripts/rbp/"
  cp "$SCRIPT_DIR/scripts/save-progress-to-beads.sh" "$TARGET_DIR/scripts/rbp/"

  # Quick-plan integration scripts
  cp "$SCRIPT_DIR/scripts/parse-spec-to-beads.sh" "$TARGET_DIR/scripts/rbp/"
  cp "$SCRIPT_DIR/scripts/ralph-execute.sh" "$TARGET_DIR/scripts/rbp/"

  # Observability integration
  cp "$SCRIPT_DIR/scripts/emit-event.sh" "$TARGET_DIR/scripts/rbp/"

  # Make scripts executable
  chmod +x "$TARGET_DIR/scripts/rbp/"*.sh

  print_success "Scripts installed"
  echo ""
}

# Step 3: Install commands
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

# Step 4: Setup hooks in settings.json
install_hooks() {
  print_step "Configuring Claude Code hooks..."

  local settings_file="$TARGET_DIR/.claude/settings.json"
  mkdir -p "$TARGET_DIR/.claude"

  if [ -f "$settings_file" ]; then
    # Check if hooks already configured
    if grep -q "show-active-task" "$settings_file" 2>/dev/null; then
      print_success "Hooks already configured"
      echo ""
      return
    fi

    # Backup existing settings
    cp "$settings_file" "$settings_file.bak"
    print_success "Backed up existing settings.json"

    echo -e "${YELLOW}  Note: Manual hook configuration may be needed.${NC}"
    echo -e "${YELLOW}  See templates/settings.json for hook configuration.${NC}"
  else
    # Create new settings.json from template
    if [ -f "$SCRIPT_DIR/templates/settings.json" ]; then
      cp "$SCRIPT_DIR/templates/settings.json" "$settings_file"
      print_success "Created settings.json with RBP hooks"
    else
      echo '{}' > "$settings_file"
      echo -e "${YELLOW}  Created empty settings.json - configure hooks manually${NC}"
    fi
  fi

  echo ""
}

# Step 5: Initialize beads if needed
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

# Step 6: Create config if not exists
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

# Step 7: Copy validator
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
  echo "Next steps:"
  echo "  1. Review configuration: $TARGET_DIR/rbp-config.yaml"
  echo "  2. Run validation: $TARGET_DIR/scripts/rbp/validate.sh"
  echo ""
  echo "Workflow A - BMAD Stories:"
  echo "  3a. Create a story: /bmad:bmm:workflows:create-story"
  echo "  4a. Convert to beads: ./scripts/rbp/parse-story-to-beads.sh <story.md>"
  echo "  5a. Start execution: ./scripts/rbp/ralph.sh"
  echo ""
  echo "Workflow B - Quick-Plan Specs:"
  echo "  3b. Create a spec: /quick-plan \"feature description\""
  echo "  4b. Execute with RBP: ./scripts/rbp/ralph-execute.sh specs/<spec>.md"
  echo "      (Includes optional Codex review + Beads + test-gated execution)"
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
}

# Main installation flow
main() {
  print_banner

  echo "Installing RBP Stack to: $TARGET_DIR"
  echo ""

  check_prerequisites
  install_scripts
  install_commands
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
    echo "Usage: ./install.sh [target-directory]"
    echo ""
    echo "Arguments:"
    echo "  target-directory  Directory to install RBP Stack (default: current directory)"
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
  *)
    main
    ;;
esac
