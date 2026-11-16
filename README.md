# TaskLedger — Illustrator AI Evaluation & QA Ledger

**TaskLedger** is a personal work-management system tailored for a freelance senior illustrator completing AI evaluation and training tasks on a labeling platform. It tracks the full lifecycle of each evaluation task from batch claiming through the 7-variation production protocol, sequential LLM & Human QA reviews, revision loops, and weekly timesheets.

## Setup & Development

```bash
# Install dependencies
npm install

# Start the development server on port 3000
npm run dev

# Type-check / lint
npm run lint

# Build for production
npm run build
```

## Architecture Note

1. **Repository-Backed Data Layer (`src/lib/repository.ts`)**:
   - All persistence goes through the `ITaskLedgerRepository` interface, implemented by `LocalStorageTaskLedgerRepository` under the `taskledger_v1_snapshot` storage key.
   - To swap in a remote backend (REST, GraphQL, or PostgreSQL/Drizzle), implement `ITaskLedgerRepository` without modifying UI components or store consumers.
2. **State & Domain Rules (`src/store/useTaskStore.ts`)**:
   - Powered by Zustand with strict domain invariant enforcement:
     - **7-Variation Submission Gate**: Tasks in `In Progress` or `Revision` cannot transition to `Submitted` until all required variation slots (`7/7` by default) have an uploaded image or platform link/note.
     - **Sequential QA Pipeline**: Human QA review scores (`1.0` to `5.0`, one decimal) can only be recorded after an automated `qaLLM` score is logged.
     - **Automatic Pass / Revision Routing**: Recording a Human QA score `>= passThreshold` (configurable in Settings, default `4.0`) automatically transitions the task to `Reviewed`. A score below the threshold requires reviewer feedback text, increments `revisionCount`, records structured `RevisionCauseTag` metadata, and routes the task to `Revision` (surfaced at the top of `In Progress`).
   - Includes a global live session timer that syncs elapsed minutes directly into both the task's `timeSpentMinutes` and the corresponding day cell in the **Weekly Worksheet**.
3. **Design System (`src/index.css` & `src/components/ui/`)**:
   - Warm editorial stationery palette (`#FAF8F5` paper canvas, `#FFFFFF` surface, `#E7E1D8` hairline borders, `#26231F` ink) paired with high-contrast semantic pastel badges (Sky, Butter, Lavender, Rose, Sage, Peach) and a calibrated Dark Mode (`@custom-variant dark`).
   - Typography pairs **Bricolage Grotesque** for display headers and KPI numerals with **Plus Jakarta Sans** for UI controls and **JetBrains Mono** (`tabular-nums`) for scores, timers, and timesheet grids.
