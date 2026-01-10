#!/usr/bin/env bats
# emit-event.bats - Tests for emit-event.sh RBP event emitter
#
# Run with: bats rbp/tests/emit-event.bats

# Setup - load the script and create temp directory
setup() {
  # Get the directory of this test file
  TEST_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")" && pwd)"
  PROJECT_ROOT="$(dirname "$TEST_DIR")"

  # Source the script
  source "$PROJECT_ROOT/scripts/emit-event.sh"

  # Create temp directory for event files
  export TEST_EVENT_DIR=$(mktemp -d)

  # Override the get_event_file function to use temp dir
  get_event_file() {
    echo "$TEST_EVENT_DIR/test-events.jsonl"
  }

  # Set a predictable session ID
  export RBP_SESSION_ID="test-session-123"
  export RBP_OBSERVABILITY_ENABLED="true"
  export RBP_SOURCE_APP="RBP"
}

# Teardown - clean up temp files
teardown() {
  rm -rf "$TEST_EVENT_DIR"
}

# =============================================================================
# JSON Output Tests
# =============================================================================

@test "emit_rbp_event creates valid JSON output" {
  emit_rbp_event "RBP:TestEvent" '{"key":"value"}'

  # File should exist
  [ -f "$TEST_EVENT_DIR/test-events.jsonl" ]

  # Content should be valid JSON
  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")
  echo "$content" | jq -e '.' > /dev/null
}

@test "emit_rbp_event JSON has required fields" {
  emit_rbp_event "RBP:TestEvent" '{"test_data":"hello"}'

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")

  # Check for required top-level fields
  echo "$content" | jq -e '.source_app' > /dev/null
  echo "$content" | jq -e '.session_id' > /dev/null
  echo "$content" | jq -e '.hook_event_type' > /dev/null
  echo "$content" | jq -e '.payload' > /dev/null
  echo "$content" | jq -e '.timestamp' > /dev/null
  echo "$content" | jq -e '.timestamp_pst' > /dev/null
}

@test "emit_rbp_event includes rbp_data in payload" {
  emit_rbp_event "RBP:TaskStart" '{"task_id":"test-001","task_title":"Test Task"}'

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")

  # Check rbp_data is in payload
  local task_id=$(echo "$content" | jq -r '.payload.rbp_data.task_id')
  [ "$task_id" = "test-001" ]

  local task_title=$(echo "$content" | jq -r '.payload.rbp_data.task_title')
  [ "$task_title" = "Test Task" ]
}

@test "emit_rbp_event uses correct session ID" {
  export RBP_SESSION_ID="custom-session-456"
  emit_rbp_event "RBP:TestEvent" '{}'

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")
  local session_id=$(echo "$content" | jq -r '.session_id')

  [ "$session_id" = "custom-session-456" ]
}

@test "emit_rbp_event uses correct source app" {
  export RBP_SOURCE_APP="CustomApp"
  emit_rbp_event "RBP:TestEvent" '{}'

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")
  local source_app=$(echo "$content" | jq -r '.source_app')

  [ "$source_app" = "CustomApp" ]
}

@test "emit_rbp_event timestamp is numeric" {
  emit_rbp_event "RBP:TestEvent" '{}'

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")
  local timestamp=$(echo "$content" | jq -r '.timestamp')

  # Timestamp should be a number (ms since epoch)
  [[ "$timestamp" =~ ^[0-9]+$ ]]

  # Should be a reasonable timestamp (after 2020)
  [ "$timestamp" -gt 1577836800000 ]
}

@test "emit_rbp_event defaults to empty object when no data provided" {
  emit_rbp_event "RBP:TestEvent"

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")
  local rbp_data=$(echo "$content" | jq -r '.payload.rbp_data')

  [ "$rbp_data" = "{}" ]
}

# =============================================================================
# Sanitization Tests
# =============================================================================

@test "sanitize_output redacts API keys" {
  local input='config: api_key="sk-1234567890abcdef"'
  local output=$(sanitize_output "$input")

  [[ "$output" != *"sk-1234567890abcdef"* ]]
  [[ "$output" == *"[REDACTED]"* ]]
}

@test "sanitize_output redacts passwords" {
  local input='password=mysecretpassword123'
  local output=$(sanitize_output "$input")

  [[ "$output" != *"mysecretpassword123"* ]]
  [[ "$output" == *"[REDACTED]"* ]]
}

@test "sanitize_output redacts bearer tokens" {
  local input='token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature'
  local output=$(sanitize_output "$input")

  [[ "$output" != *"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"* ]]
  [[ "$output" == *"[REDACTED]"* ]]
}

@test "sanitize_output redacts AWS keys" {
  local input='AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE'
  local output=$(sanitize_output "$input")

  [[ "$output" != *"AKIAIOSFODNN7EXAMPLE"* ]]
  [[ "$output" == *"[AWS_KEY_REDACTED]"* ]]
}

@test "sanitize_output redacts JSON secrets" {
  local input='{"api_key": "secret123456789", "name": "test"}'
  local output=$(sanitize_output "$input")

  [[ "$output" != *"secret123456789"* ]]
  [[ "$output" == *"[REDACTED]"* ]]
}

@test "sanitize_output redacts URLs with credentials" {
  local input='https://user:password123@api.example.com/path'
  local output=$(sanitize_output "$input")

  [[ "$output" != *"password123"* ]]
  [[ "$output" == *"[CREDENTIALS_REDACTED]"* ]]
}

@test "sanitize_output redacts private keys" {
  local input='-----BEGIN RSA PRIVATE KEY----- some key data'
  local output=$(sanitize_output "$input")

  [[ "$output" == *"[PRIVATE_KEY_REDACTED]"* ]]
}

@test "sanitize_output redacts hex-encoded secrets" {
  # 32 character hex string without prefix (pure hex)
  local input='hash: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
  local output=$(sanitize_output "$input")

  # The hex string should be redacted (replaced with HEX_REDACTED)
  [[ "$output" != *"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"* ]]
  [[ "$output" == *"[HEX_REDACTED]"* ]]
}

@test "sanitize_output preserves non-sensitive data" {
  local input='Normal log message with no secrets'
  local output=$(sanitize_output "$input")

  [ "$output" = "$input" ]
}

@test "sanitize_output handles case-insensitive patterns" {
  local input1='API_KEY=mysecret12345678'
  local input2='api_key=mysecret12345678'
  local input3='ApiKey=mysecret12345678'

  local output1=$(sanitize_output "$input1")
  local output2=$(sanitize_output "$input2")
  local output3=$(sanitize_output "$input3")

  [[ "$output1" == *"[REDACTED]"* ]]
  [[ "$output2" == *"[REDACTED]"* ]]
  [[ "$output3" == *"[REDACTED]"* ]]
}

# =============================================================================
# Error Handling Tests
# =============================================================================

@test "emit_rbp_event returns 0 when observability disabled" {
  export RBP_OBSERVABILITY_ENABLED="false"

  run emit_rbp_event "RBP:TestEvent" '{"key":"value"}'
  [ "$status" -eq 0 ]

  # No file should be created
  [ ! -f "$TEST_EVENT_DIR/test-events.jsonl" ]
}

@test "emit_rbp_event handles missing event type gracefully" {
  # Event type is required but let's verify behavior
  run emit_rbp_event "" '{"key":"value"}'

  # Should still create valid JSON (event_type will be empty string)
  if [ -f "$TEST_EVENT_DIR/test-events.jsonl" ]; then
    local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")
    echo "$content" | jq -e '.' > /dev/null
  fi
}

@test "emit_rbp_event fails gracefully with invalid JSON data" {
  # Invalid JSON should cause jq to fail
  run emit_rbp_event "RBP:TestEvent" 'not-valid-json'

  # Should fail and not write to file
  [ "$status" -ne 0 ] || [ ! -f "$TEST_EVENT_DIR/test-events.jsonl" ] || \
    [ ! -s "$TEST_EVENT_DIR/test-events.jsonl" ]
}

@test "emit_rbp_event returns non-zero when directory creation fails" {
  # Point to an invalid path
  get_event_file() {
    echo "/nonexistent/impossible/path/events.jsonl"
  }

  run emit_rbp_event "RBP:TestEvent" '{}'

  [ "$status" -ne 0 ]
}

# =============================================================================
# Convenience Function Tests
# =============================================================================

@test "emit_loop_start creates valid event" {
  emit_loop_start 1 50

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")
  local event_type=$(echo "$content" | jq -r '.hook_event_type')
  local iteration=$(echo "$content" | jq -r '.payload.rbp_data.iteration')
  local max=$(echo "$content" | jq -r '.payload.rbp_data.max_iterations')

  [ "$event_type" = "RBP:LoopStart" ]
  [ "$iteration" = "1" ]
  [ "$max" = "50" ]
}

@test "emit_loop_end creates valid event" {
  emit_loop_end 5 "completed"

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")
  local event_type=$(echo "$content" | jq -r '.hook_event_type')
  local iteration=$(echo "$content" | jq -r '.payload.rbp_data.iteration')
  local status=$(echo "$content" | jq -r '.payload.rbp_data.status')

  [ "$event_type" = "RBP:LoopEnd" ]
  [ "$iteration" = "5" ]
  [ "$status" = "completed" ]
}

@test "emit_task_start creates valid event" {
  emit_task_start 1 "task-001" "Implement feature X"

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")
  local event_type=$(echo "$content" | jq -r '.hook_event_type')
  local task_id=$(echo "$content" | jq -r '.payload.rbp_data.task_id')
  local task_title=$(echo "$content" | jq -r '.payload.rbp_data.task_title')

  [ "$event_type" = "RBP:TaskStart" ]
  [ "$task_id" = "task-001" ]
  [ "$task_title" = "Implement feature X" ]
}

@test "emit_task_complete creates valid event" {
  emit_task_complete 3 "task-001" "closed"

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")
  local event_type=$(echo "$content" | jq -r '.hook_event_type')
  local task_id=$(echo "$content" | jq -r '.payload.rbp_data.task_id')
  local bead_status=$(echo "$content" | jq -r '.payload.rbp_data.bead_status')

  [ "$event_type" = "RBP:TaskComplete" ]
  [ "$task_id" = "task-001" ]
  [ "$bead_status" = "closed" ]
}

@test "emit_test_result sanitizes test output" {
  emit_test_result 1 "task-001" 0 "Test passed with api_key=secretkey12345678"

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")
  local test_output=$(echo "$content" | jq -r '.payload.rbp_data.test_output')

  # Sensitive data should be redacted
  [[ "$test_output" != *"secretkey12345678"* ]]
  [[ "$test_output" == *"[REDACTED]"* ]]
}

@test "emit_error creates valid event" {
  emit_error 2 "task-001" "Something went wrong"

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")
  local event_type=$(echo "$content" | jq -r '.hook_event_type')
  local error_msg=$(echo "$content" | jq -r '.payload.rbp_data.error_message')

  [ "$event_type" = "RBP:Error" ]
  [ "$error_msg" = "Something went wrong" ]
}

# =============================================================================
# Timestamp Function Tests
# =============================================================================

@test "get_timestamp_ms returns numeric milliseconds" {
  local ts=$(get_timestamp_ms)

  # Should be numeric
  [[ "$ts" =~ ^[0-9]+$ ]]

  # Should be reasonable (13 digits for ms timestamp after 2001)
  [ ${#ts} -ge 13 ]
}

@test "get_timestamp_pst returns formatted date string" {
  local ts=$(get_timestamp_pst)

  # Should match format: YYYY-MM-DD HH:MM:SS TZ
  [[ "$ts" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}\ [0-9]{2}:[0-9]{2}:[0-9]{2}\ [A-Z]{3}$ ]]
}

# =============================================================================
# Edge Case Tests
# =============================================================================

@test "emit_rbp_event handles special characters in data" {
  emit_rbp_event "RBP:TestEvent" '{"message":"Hello \"world\" with newline\nand tab\t"}'

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")

  # Should still be valid JSON
  echo "$content" | jq -e '.' > /dev/null
}

@test "emit_rbp_event handles unicode in data" {
  emit_rbp_event "RBP:TestEvent" '{"message":"Hello 世界 🎉"}'

  local content=$(cat "$TEST_EVENT_DIR/test-events.jsonl")

  # Should still be valid JSON and preserve unicode
  echo "$content" | jq -e '.' > /dev/null
  [[ "$content" == *"世界"* ]]
}

@test "multiple emit calls append to same file" {
  emit_rbp_event "RBP:Event1" '{"order":1}'
  emit_rbp_event "RBP:Event2" '{"order":2}'
  emit_rbp_event "RBP:Event3" '{"order":3}'

  # Should have 3 lines
  local line_count=$(wc -l < "$TEST_EVENT_DIR/test-events.jsonl" | tr -d ' ')
  [ "$line_count" -eq 3 ]

  # Each line should be valid JSON
  while IFS= read -r line; do
    echo "$line" | jq -e '.' > /dev/null
  done < "$TEST_EVENT_DIR/test-events.jsonl"
}
