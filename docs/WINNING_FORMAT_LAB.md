# Winning Format Lab

## Product decision

AutoScale's core product is not a rendered video. It is a source-backed decision about which short-form video format to scale, iterate, or kill.

The Growth Run unit is now:

```txt
one audience pain
→ one or two format hypotheses
→ three controlled hook variants per format
→ fixed audience, body, CTA, platform, and duration
→ fixed evaluation window
→ business-result measurement
→ scale, iterate, or kill
```

## What is implemented

### Persisted format fingerprints

`format_fingerprints` stores:

- format and platform
- hook mechanism
- visual grammar
- script structure
- CTA pattern
- business hypothesis
- transferability score
- distortion risk
- confidence and missing evidence
- linked source videos and mined patterns
- current decision state

### Controlled experiment matrices

`controlled_experiments` defines the fixed fields and tested variable. `experiment_cells` links each concept to its variant label and variable value.

The initial planner creates at most two format hypotheses and exactly three hook variants per format. It no longer asks the model for 12 unrelated concepts.

### Trend Receipts

Every new controlled concept receives a persisted `trend_receipts` row that separates:

- observed evidence
- strategic inference
- expected signal
- reasoning
- confidence
- missing evidence

Unknown or unlinked evidence lowers confidence and remains visible instead of being silently converted into a claim.

### Learning-aware strategy

The Video Strategy Agent now reads weighted `learning_memory` and recent `kill_decisions`. Positive repeated evidence can increase a format's share; killed and negative-weight formats are suppressed unless new evidence justifies another test.

### Winner materialization

Compound now:

1. links results back to the controlled experiment and format fingerprint;
2. updates the format decision to winner, iterate, or killed;
3. creates a child Growth Run for a winner;
4. generates exactly three controlled hook variants while preserving the winning format, audience, promise, CTA, platform, and duration;
5. creates real child concepts, experiment cells, and Trend Receipts;
6. renders the child videos immediately for a manual Compound run;
7. leaves service-role/autopilot variants in an explicit worker-pending state instead of pretending they rendered.

## Evidence chain

```txt
source video / mined pattern
→ format fingerprint
→ controlled experiment
→ experiment cell
→ concept
→ Trend Receipt
→ script / storyboard / rendered video
→ account / schedule item
→ view / click / signup / activation / payment
→ result classification
→ format decision
→ child Growth Run
→ winner variants
```

## Trust levels

- Manual: all videos require review; winner variants render immediately when the founder runs Compound.
- Assisted: safe low-risk formats may be approved after quality gates are implemented.
- Autopilot: remains explicit opt-in. Service-role winner variants are materialized but marked worker-pending until a queue-backed renderer exists.

AutoScale should automate proven plays, not uncertainty.

## Operational gaps that remain

The following are not falsely claimed as complete:

1. Queue-backed rendering, idempotent retries, and resumable partial failures.
2. Platform posted-status and analytics synchronization from Postiz.
3. Transcript and frame-level video analysis.
4. Account-size normalization and reliable save-rate collection.
5. Playback quality scoring, subtitle safe zones, pacing, voice quality, music/SFX, and revision controls.
6. A unified Growth Graph event stream and platform metric ingestion.
7. A real daily worker that produces the Daily Growth Pack.
8. Account-health enforcement strong enough for assisted or full autopilot.

## Next operational milestone

Apply migration `0016_winning_format_lab.sql`, then prove one real founder-controlled loop:

```txt
URL
→ stored evidence
→ controlled format test
→ playable videos
→ Postiz test account
→ tracked click/signup/payment
→ Compound decision
→ rendered child winner variants
```

Do not expand feature scope until this path succeeds with real providers and persisted data.
