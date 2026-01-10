#!/usr/bin/env bash
# RBP Stack Uninstaller
# Usage: ./uninstall.sh [target-directory]
#
# Removes RBP Stack from a project directory.
# Does NOT remove .beads/ (your task state) - run 'rm -rf .beads' manually if desired.

set -e

TARGET_DIR="${1:-.}"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_banner() {
  echo -e "${CYAN}"
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║              RBP Stack Uninstaller                        ║"
  echo "╚═══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

print_step() {
  echo -e "${YELLOW}→ $1${NC}"
}

print_success() {
  echo -e "${GREEN}  ✓ $1${NC}"
}

print_skip() {
  echo -e "  - $1 (not found)"
}

# Check if directory exists and remove it
remove_dir() {
  local dir="$1"
  local desc="$2"

  if [ -d "$dir" ]; then
    rm -rf "$dir"
    print_success "Removed $desc"
  else
    print_skip "$desc"
  fi
}

# Check if file exists and remove it
remove_file() {
  local file="$1"
  local desc="$2"

  if [ -f "$file" ]; then
    rm -f "$file"
    print_success "Removed $desc"
  else
    print_skip "$desc"
  fi
}

# Main uninstall
main() {
  print_banner

  echo "Uninstalling RBP Stack from: $TARGET_DIR"
  echo ""

  # Confirm
  read -p "This will remove RBP scripts and commands. Continue? (y/n): " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Cancelled."
    exit 0
  fi
  echo ""

  # Remove RBP scripts
  print_step "Removing scripts..."
  remove_dir "$TARGET_DIR/scripts/rbp" "scripts/rbp/"

  # Remove parent scripts dir if empty
  if [ -d "$TARGET_DIR/scripts" ] && [ -z "$(ls -A "$TARGET_DIR/scripts" 2>/dev/null)" ]; then
    rmdir "$TARGET_DIR/scripts"
    print_success "Removed empty scripts/"
  fi
  echo ""

  # Remove RBP commands
  print_step "Removing slash commands..."
  remove_dir "$TARGET_DIR/.claude/commands/rbp" ".claude/commands/rbp/"

  # Remove parent commands dir if empty
  if [ -d "$TARGET_DIR/.claude/commands" ] && [ -z "$(ls -A "$TARGET_DIR/.claude/commands" 2>/dev/null)" ]; then
    rmdir "$TARGET_DIR/.claude/commands"
    print_success "Removed empty .claude/commands/"
  fi
  echo ""

  # Remove RBP runtime state
  print_step "Removing runtime state..."
  remove_dir "$TARGET_DIR/.rbp" ".rbp/"
  echo ""

  # Remove config (ask first)
  if [ -f "$TARGET_DIR/rbp-config.yaml" ]; then
    read -p "Remove rbp-config.yaml? (y/n): " remove_config
    if [[ "$remove_config" == "y" || "$remove_config" == "Y" ]]; then
      remove_file "$TARGET_DIR/rbp-config.yaml" "rbp-config.yaml"
    else
      echo -e "  Keeping rbp-config.yaml"
    fi
    echo ""
  fi

  # Note about beads
  if [ -d "$TARGET_DIR/.beads" ]; then
    echo -e "${YELLOW}Note: .beads/ directory preserved (contains your task state)${NC}"
    echo -e "      Remove manually if desired: rm -rf .beads"
    echo ""
  fi

  # Note about settings.json
  if [ -f "$TARGET_DIR/.claude/settings.json" ]; then
    echo -e "${YELLOW}Note: .claude/settings.json preserved${NC}"
    echo -e "      Remove RBP hooks manually if desired"
    echo ""
  fi

  # Summary
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}RBP Stack Uninstalled${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
}

# Handle help argument
case "${1:-}" in
  --help|-h)
    echo "RBP Stack Uninstaller"
    echo ""
    echo "Usage: ./uninstall.sh [target-directory]"
    echo ""
    echo "Arguments:"
    echo "  target-directory  Directory to uninstall from (default: current directory)"
    echo ""
    echo "This will remove:"
    echo "  - scripts/rbp/               (RBP scripts)"
    echo "  - .claude/commands/rbp/      (slash commands)"
    echo "  - .rbp/                      (runtime state)"
    echo "  - rbp-config.yaml            (optional, asks first)"
    echo ""
    echo "This will NOT remove:"
    echo "  - .beads/                    (your task state - remove manually if needed)"
    echo "  - .claude/settings.json      (may contain other settings)"
    exit 0
    ;;
  *)
    main
    ;;
esac
