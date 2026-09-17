# Repair hints

- Treat a post-fix failure as a failed assertion rather than a fresh first-pass bug: the first patch usually corrects the filter predicate, and the check may already list only the completed task titles after clicking Completed.
- The remaining failure is typically that completed rows do not expose any status word or semantic marker (completed/done) in their row text or accessible output, so the check cannot distinguish them as completed.
- Preserve the filter behavior and make completed rows explicitly expose a completed/done status word.
- Avoid active/open/todo/schedule wording anywhere in the Completed view.
