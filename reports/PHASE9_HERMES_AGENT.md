# Phase 9 Hermes Agent

## Status
Hermes is not deployed in this pass.

## Role
Hermes is a worker runtime.

## Allowed
Execute queued jobs, call approved tools, summarize results.

## Forbidden
Direct database writes, direct production deploys, direct provider access.

## Integration Point
Hermes should claim work through `queue_jobs` and return results through queue completion APIs.
