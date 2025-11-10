#!/bin/bash

# Claude API Toggle Script
# Easily switch between Anthropic API key and Claude Code subscription

MODE=${1:-status}

show_help() {
    echo -e "\n=== Claude API Toggle Script ==="
    echo -e "\nUsage: ./toggle-claude.sh [mode]\n"
    echo "Modes:"
    echo "  api          - Switch to Anthropic API key"
    echo "  subscription - Switch to Claude Code subscription (unset API key)"
    echo "  status       - Check current configuration"
    echo "  help         - Show this help message"
    echo -e "\nExamples:"
    echo "  ./toggle-claude.sh api"
    echo "  ./toggle-claude.sh subscription"
    echo "  ./toggle-claude.sh status"
    echo ""
}

show_status() {
    echo -e "\n=== Current Claude Configuration ==="

    if [ -n "$ANTHROPIC_API_KEY" ]; then
        echo -e "\nMode: Anthropic API Key"
        echo "API Key (first 20 chars): ${ANTHROPIC_API_KEY:0:20}..."
        echo -e "\nYou are using your Anthropic API key for Claude requests."
    else
        echo -e "\nMode: Claude Code Subscription"
        echo -e "\nYou are using your Claude Code subscription."
    fi
    echo ""
}

set_api_mode() {
    # Check if API key is already configured
    API_KEY_FILE="$(dirname "$0")/api-key.txt"

    if [ ! -f "$API_KEY_FILE" ]; then
        echo -e "\n[ERROR] API key file not found!"
        echo -e "\nPlease create a file named 'api-key.txt' in the same directory as this script."
        echo "Put your Anthropic API key in that file (just the key, nothing else)."
        echo -e "\nExample: sk-ant-api03-..."
        echo ""
        return 1
    fi

    API_KEY=$(cat "$API_KEY_FILE" | tr -d '\n\r')
    API_KEY=$(echo "$API_KEY" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    if [ -z "$API_KEY" ]; then
        echo -e "\n[ERROR] API key file is empty!"
        echo "Please add your Anthropic API key to api-key.txt"
        echo ""
        return 1
    fi

    export ANTHROPIC_API_KEY="$API_KEY"

    echo -e "\n=== Switched to Anthropic API ==="
    echo -e "\nAPI Key (first 20 chars): ${API_KEY:0:20}..."
    echo -e "\nYou are now using your Anthropic API key."
    echo "This setting applies to this shell session only."
    echo ""
}

set_subscription_mode() {
    # Unset the API key to use Claude Code subscription
    if [ -n "$ANTHROPIC_API_KEY" ]; then
        unset ANTHROPIC_API_KEY
        echo -e "\n=== Switched to Claude Code Subscription ==="
        echo -e "\nAPI key has been removed from this session."
        echo "You are now using your Claude Code subscription."
        echo ""
    else
        echo -e "\n=== Already using Claude Code Subscription ==="
        echo -e "\nNo API key is currently set."
        echo ""
    fi
}

# Main logic
case $MODE in
    api)
        set_api_mode
        ;;
    subscription)
        set_subscription_mode
        ;;
    status)
        show_status
        ;;
    help)
        show_help
        ;;
    *)
        echo "Invalid mode. Use 'help' for usage information."
        exit 1
        ;;
esac