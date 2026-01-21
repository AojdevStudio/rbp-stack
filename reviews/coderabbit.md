In @.claude/commands/rbp/start.md at line 60, The markdown contains bare URLs
and unlabeled output fences (e.g., the line "Observability Dashboard:
http://localhost:5172" and similar report references) which trigger MD034/MD040;
update those occurrences by wrapping each URL in angle brackets or converting to
a markdown link (for example <http://localhost:5172>) and change unlabeled code
fences to include a language tag like ```text so the output block is labeled;
apply these edits to the Observability Dashboard snippet and the other report
URL occurrences mentioned (the lines around "Observability Dashboard:
http://localhost:5172" and the later report references).

In @.gitattributes around lines 2 - 3, The .gitattributes entry registers a
custom merge driver named "beads" for .beads/issues.jsonl but no driver is
configured, so add a repository-level git merge driver configuration for the
"beads" driver (pointing to the intended merge tool/command and any required
attributes) or, alternatively, add a short note to the project setup docs
explaining how contributors should configure the "beads" merge driver in their
local/global git config; ensure the instructions reference the merge driver name
"beads" and the .beads/issues.jsonl attribute so collaborators can reproduce the
setup.

In `@scripts/rbp/close-with-proof.sh` around lines 82 - 105, Replace hardcoded
"bun run test" and its summary label with the configured RBP_TEST_COMMAND and a
generic label: call emit_test_run and emit_test_result using "$RBP_TEST_COMMAND"
(not the literal bun command), execute TEST_OUTPUT=$($RBP_TEST_COMMAND 2>&1) and
capture TEST_EXIT_CODE as before, and append a generic PROOF_SUMMARY entry like
"test: PASS/FAIL (exit code X)" using PROOF_SUMMARY instead of "bun test". Also
apply the same change for the typecheck step (replace the hardcoded "bun run
typecheck" with "$RBP_TEST_COMMAND" or the appropriate RBP_TYPECHECK_COMMAND if
present), and keep existing variables/flow (emit_test_run, emit_test_result,
TEST_OUTPUT, TEST_EXIT_CODE, TESTS_PASSED) intact.

In `@scripts/rbp/parse-story-to-beads.sh` around lines 110 - 134, The
SUBTASK_COUNT increment is lost because the loop runs in a subshell created by
the pipeline; change the loop to avoid a subshell so SUBTASK_COUNT retains its
value (e.g., replace the pipeline "echo "$SUBTASKS" | while IFS= read -r
subtask; do ... done" with a here-string or process-substitution variant that
feeds "$SUBTASKS" into the while loop directly), leaving the body intact
(references: SUBTASK_COUNT, SUBTASKS, UI_KEYWORDS, the while loop that reads
"subtask"). Ensure the rest of the logic (SUBTASK_IS_UI detection and bd create
calls) remains unchanged so CREATED_COUNT logic can rely on the preserved
SUBTASK_COUNT after the loop.

In `@scripts/rbp/ralph.sh` around lines 56 - 70, The python3 fallback invocation
can fail with ImportError when PyYAML isn't present and, under set -e, will
abort the script; modify the python3 -c call used to compute value (the block
that reads CONFIG_FILE and sets obs/get('enabled')) so that failures don't
propagate—e.g., append || value="true" to the python3 invocation or wrap the
import in a try/except that prints "true" on error—so that
RBP_OBSERVABILITY_ENABLED defaults to "true" on any python parsing failure.

In `@scripts/rbp/save-progress-to-beads.sh` around lines 33 - 35, The variables
OPEN_COUNT and TOTAL_COUNT are assigned "?" on command failure which breaks the
later arithmetic (lines referencing the calculation around lines 46-47); change
the assignment and guarding logic so failures yield a safe numeric fallback
(e.g., 0) or validate/normalize the values before arithmetic. Specifically,
update the OPEN_COUNT and TOTAL_COUNT assignments (and any use of CURRENT_TASK)
to produce digits only (or coerce/replace "?" with 0) and/or wrap the arithmetic
in an integer-check (e.g., test with a regex or use parameter expansion to
default non-numeric values to 0) so the subsequent subtraction/addition cannot
fail when bd commands fail.

In `@scripts/rbp/show-active-task.sh` around lines 52 - 55, The arithmetic fails
when OPEN_COUNT or TOTAL_COUNT is set to "?" on command failure; change the
assignment/usage so non-numeric fallbacks become a safe integer (e.g., 0) before
doing $((TOTAL_COUNT - OPEN_COUNT)). Specifically, after populating OPEN_COUNT
and TOTAL_COUNT (the variables in this diff), coerce or validate them to digits
(use parameter expansion or a numeric-check) and replace "?" with 0 so the
subtraction and the echo "Progress: $((TOTAL_COUNT - OPEN_COUNT))/$TOTAL_COUNT
tasks complete" always operates on integers.

