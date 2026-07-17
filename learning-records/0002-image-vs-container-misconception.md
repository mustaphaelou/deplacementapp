# Misconception: image = the running thing, stages = all ship

After Lesson 0001 the user answered three retrieval questions and got all three wrong in a consistent direction:

- Thought the live port-3000 deployment = "an image" (not a container).
- Thought baking a new env var = "modify the container; the image follows it" (backwards — container edits do NOT reach the image; you edit the Dockerfile and rebuild).
- Thought the multi-stage Dockerfile ships "all five stages bundled" (only the final `runner` stage ships; the other four are scaffolding).

**Why this matters for future sessions:**
The core misconception is one cluster: the user hasn't yet internalized <em>image ≠ container</em>, and as a consequence hasn't separated stage from image either. Treating the image as the live thing makes "edit Dockerfile vs restart container" indistinguishable, and makes multi-stage pointless in their head.

**Implications:**
- Do NOT advance to Lesson 0002 (reading the Dockerfile stage by stage). It presupposes the four-noun distinction.
- Re-teach 0001 with a different angle: lead with the recipe/cake metaphor up front, then a concrete destructive demo (edit a running container, restart it, watch the edit vanish), then re-quiz.
- Use a *different* quiz format on the reteach — same questions, but forced into a concrete scenario the user can trace, not abstract noun-matching. Spacing + reformatting = better storage strength than just re-reading.
- Mark this record as evidence that "command-line fluency masks conceptual gaps" (confirmed in LR-0001) is severe enough to warrant reteaching, not just advancing.
