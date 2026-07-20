# Mission (this session)

Understand the trade-offs around **whether to keep or delete a query function** (`canTransition`) when collapsing a three-layer state-machine guard into a single throwing function (`buildTransition`). This is a concrete exercise in **Command-Query Separation** applied to state machine design.

## Why

I'm designing a refactor of the DemandeDeplacement workflow and need to decide the fate of `canTransition` — keep it (internal or exported), or delete it entirely. I want to understand the consequences of each choice so I can make an informed decision.
