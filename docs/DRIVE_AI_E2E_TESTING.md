# Drive AI E2E Testing Strategy

## Overview

This document describes the comprehensive end-to-end testing strategy for the multi-engine AI Drive analysis system. The tests validate the complete workflow from engine resolution through result storage with transparent routing in production scenarios.

## Test Architecture

### Test Layers

```
┌─────────────────────────────────────────────────────────────┐
│  E2E Tests (Integration)                                    │
│  - Full workflow: engine resolution → analysis → storage    │
│  - Routing rule matching with conditions                    │
│  - Feedback tracking and engine performance metrics         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Resolver Tests (Unit)                                      │
│  - Engine selection logic                                   │
│  - Condition matching (tokens, artifacts, context)         │
│  - Fallback and priority handling                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Router Tests (Unit)                                        │
│  - tRPC endpoint validation                                 │
│  - Input validation with Zod                               │
│  - RBAC and admin-only access                              │
└─────────────────────────────────────────────────────────────┘
```

## Test Scenarios

### 1. Engine Resolution (Core Functionality)

**Scenario 1.1: Primary Engine Selection**
- **Given**: No routing rules configured
- **When**: Resolve engine for any use case
- **Then**: Should return primary engine with full configuration
- **Validation**: 
  - Engine UID matches primary
  - Provider, model, timeout, retries are correct
  - Source is "ENGINE"

**Scenario 1.2: Routing Rule Matching**
- **Given**: Routing rule configured for DRIVE_DIAG → Claude
- **When**: Resolve engine for DRIVE_DIAG use case
- **Then**: Should return Claude engine
- **Validation**:
  - Engine UID matches rule target
  - Matched rule UID is populated
  - Rule priority is respected

**Scenario 1.3: Priority-Based Selection**
- **Given**: Multiple rules with different priorities
- **When**: Resolve engine
- **Then**: Should select rule with lowest priority number
- **Validation**:
  - Rule with priority 10 selected over priority 20
  - Consistent selection across multiple requests

**Scenario 1.4: Condition-Based Matching**
- **Given**: Rule with conditions (minTokens: 5000, hasLargeArtifacts: true)
- **When**: Resolve with matching context
- **Then**: Should match and select configured engine
- **Validation**:
  - Token estimate within range
  - Artifact flag matches condition
  - All conditions must pass (AND logic)

### 2. Routing Rule Conditions

**Scenario 2.1: Token Range Conditions**
- **Given**: Rules with token ranges (small: <2000, medium: 2000-5000, large: >5000)
- **When**: Resolve with different token estimates
- **Then**: Should select appropriate engine for each range
- **Validation**:
  - Small analysis → fast engine (Gemini)
  - Medium analysis → balanced engine (GPT-4o)
  - Large analysis → capable engine (Claude)

**Scenario 2.2: Artifact Detection**
- **Given**: Rule with hasLargeArtifacts condition
- **When**: Resolve with large artifacts detected
- **Then**: Should route to engine with higher output token limit
- **Validation**:
  - Claude (8192 tokens) selected for large artifacts
  - GPT-4o (4096 tokens) for normal artifacts

**Scenario 2.3: Long-Context Preference**
- **Given**: Rule with preferLongContext condition
- **When**: Resolve with long-context preference
- **Then**: Should select engine optimized for long context
- **Validation**:
  - Claude selected (better long-context handling)
  - Configuration reflects preference

**Scenario 2.4: Combined Conditions**
- **Given**: Rule with multiple conditions (minTokens AND hasLargeArtifacts AND preferLongContext)
- **When**: Resolve with all conditions met
- **Then**: Should match rule (AND logic)
- **When**: Resolve with one condition not met
- **Then**: Should not match rule (fallback to primary)

### 3. Fallback & Resilience

**Scenario 3.1: Fallback to Primary**
- **Given**: Routing rule condition not met
- **When**: Resolve engine
- **Then**: Should fallback to primary engine
- **Validation**:
  - Primary engine returned
  - Source is "ENGINE"
  - Consistent behavior

**Scenario 3.2: Disabled Rule Handling**
- **Given**: Routing rule is disabled
- **When**: Resolve engine
- **Then**: Should skip disabled rule and fallback
- **Validation**:
  - Disabled rule not matched
  - Primary or next enabled rule selected

**Scenario 3.3: Disabled Engine Handling**
- **Given**: Routing rule points to disabled engine
- **When**: Resolve engine
- **Then**: Should skip disabled engine and fallback
- **Validation**:
  - Disabled engine not selected
  - Primary or alternative engine selected

**Scenario 3.4: All Engines Disabled**
- **Given**: All engines in organization disabled
- **When**: Resolve engine
- **Then**: Should return DISABLED source
- **Validation**:
  - Source is "DISABLED"
  - Graceful degradation
  - No error thrown

**Scenario 3.5: Cascading Failures**
- **Given**: Multiple engines with rules
- **When**: Primary and secondary disabled
- **Then**: Should select tertiary engine
- **Validation**:
  - Fallback chain works correctly
  - Consistent selection

### 4. Analysis Result Storage

**Scenario 4.1: Engine Tracking**
- **Given**: Analysis completed with selected engine
- **When**: Store analysis result
- **Then**: Should record engine UID, name, and provider
- **Validation**:
  - selectedEngineUid populated
  - selectedEngineName matches engine
  - selectedEngineProvider correct

**Scenario 4.2: Segment Storage**
- **Given**: Analysis with multiple segments
- **When**: Store segments
- **Then**: Should link segments to analysis
- **Validation**:
  - Segment count matches
  - Analysis UID correctly linked
  - Severity levels preserved

**Scenario 4.3: Feedback Tracking**
- **Given**: User provides feedback on analysis
- **When**: Store feedback
- **Then**: Should record rating and comment
- **Validation**:
  - Feedback linked to analysis
  - Engine performance tracked
  - Rating range valid (1-5)

### 5. Production Scenarios

**Scenario 5.1: Concurrent Requests**
- **Given**: 10 concurrent resolution requests
- **When**: All requests resolve simultaneously
- **Then**: All should select same engine consistently
- **Validation**:
  - No race conditions
  - Consistent results
  - Cache working properly

**Scenario 5.2: Multi-Use-Case Consistency**
- **Given**: Rules for DRIVE_DIAG, ANALYTICS, SUMMARIZE
- **When**: Resolve each use case
- **Then**: Each should route to configured engine
- **Validation**:
  - DRIVE_DIAG → GPT-4o
  - ANALYTICS → Claude
  - SUMMARIZE → Gemini
  - No cross-contamination

**Scenario 5.3: Engine State Changes**
- **Given**: Engine disabled during operation
- **When**: Resolve engine
- **Then**: Should fallback immediately
- **When**: Engine re-enabled
- **Then**: Should use updated engine
- **Validation**:
  - State changes reflected
  - Cache invalidation working
  - No stale data

**Scenario 5.4: Rule Updates**
- **Given**: Routing rule updated
- **When**: Resolve engine
- **Then**: Should use updated rule
- **Validation**:
  - Rule changes effective immediately
  - Cache cleared properly
  - No stale rule data

### 6. Load Balancing

**Scenario 6.1: Token-Based Distribution**
- **Given**: Rules for small/medium/large token ranges
- **When**: Requests with varying token counts
- **Then**: Should distribute across engines appropriately
- **Validation**:
  - Small requests → fast engine
  - Medium requests → balanced engine
  - Large requests → capable engine

**Scenario 6.2: Condition-Based Distribution**
- **Given**: Rules with different conditions
- **When**: Requests with different characteristics
- **Then**: Should distribute based on conditions
- **Validation**:
  - Artifact-heavy → high output token engine
  - Long-context → context-capable engine
  - Balanced distribution

## Test Data Setup

### Engine Fixtures

```typescript
// Primary Engine (GPT-4o)
{
  uid: "engine-1",
  name: "GPT-4o Primary",
  provider: "OPENAI",
  model: "gpt-4o",
  enabled: true,
  isPrimary: true,
  timeoutMs: 30000,
  maxRetries: 2,
  temperature: 0.7,
  maxOutputTokens: 4096
}

// Secondary Engine (Claude)
{
  uid: "engine-2",
  name: "Claude Sonnet",
  provider: "ANTHROPIC",
  model: "claude-3-sonnet-20240229",
  enabled: true,
  isPrimary: false,
  timeoutMs: 45000,
  maxRetries: 3,
  temperature: 0.5,
  maxOutputTokens: 8192
}

// Tertiary Engine (Gemini)
{
  uid: "engine-3",
  name: "Gemini Pro",
  provider: "GEMINI",
  model: "gemini-2.0-flash",
  enabled: true,
  isPrimary: false,
  timeoutMs: 25000,
  maxRetries: 1,
  temperature: 0.8,
  maxOutputTokens: 2048
}
```

### Routing Rule Fixtures

```typescript
// Rule 1: DRIVE_DIAG → Claude
{
  useCase: "DRIVE_DIAG",
  priority: 10,
  targetEngineUid: "engine-2",
  conditionsJson: null
}

// Rule 2: High Token Analysis → Claude
{
  useCase: "DRIVE_DIAG",
  priority: 20,
  targetEngineUid: "engine-2",
  conditionsJson: { minTokens: 5000 }
}

// Rule 3: Large Artifacts → Claude
{
  useCase: "DRIVE_DIAG",
  priority: 30,
  targetEngineUid: "engine-2",
  conditionsJson: { hasLargeArtifacts: true }
}
```

## Validation Checklist

### Engine Resolution
- [ ] Primary engine selected when no rules exist
- [ ] Routing rules matched correctly
- [ ] Priority ordering respected
- [ ] Conditions evaluated with AND logic
- [ ] Disabled rules skipped
- [ ] Disabled engines skipped
- [ ] Fallback to primary working
- [ ] GENERAL use case as fallback
- [ ] Multiple use cases isolated

### Routing Conditions
- [ ] Token range conditions working
- [ ] hasLargeArtifacts condition working
- [ ] preferLongContext condition working
- [ ] Combined conditions with AND logic
- [ ] Condition mismatch triggers fallback

### Result Storage
- [ ] Engine UID stored correctly
- [ ] Engine name stored correctly
- [ ] Engine provider stored correctly
- [ ] Segments linked to analysis
- [ ] Feedback linked to analysis
- [ ] Multiple analyses per run supported

### Production Resilience
- [ ] Concurrent requests handled
- [ ] Multi-use-case consistency
- [ ] Engine state changes reflected
- [ ] Rule updates effective
- [ ] Load distribution working
- [ ] Cache invalidation working

## Performance Benchmarks

### Target Metrics

| Metric | Target | Acceptable Range |
|--------|--------|------------------|
| Resolution Time | < 50ms | < 100ms |
| Cache Hit Rate | > 95% | > 90% |
| Concurrent Requests | 100+ | 50+ |
| Fallback Time | < 10ms | < 50ms |
| Memory Usage | < 10MB | < 50MB |

### Load Testing

```bash
# Simulate 100 concurrent resolutions
for i in {1..100}; do
  resolveEngine(orgId, "DRIVE_DIAG", {}) &
done
wait

# Verify:
# - All completed successfully
# - Consistent engine selection
# - No memory leaks
# - Cache working properly
```

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Engine Selection Distribution**
   - Track which engines are selected
   - Alert if one engine selected 100% of time
   - Monitor for rule effectiveness

2. **Fallback Rate**
   - Track fallback frequency
   - Alert if > 10% fallback rate
   - Indicates rule misconfiguration

3. **Engine Availability**
   - Track disabled engines
   - Alert if primary disabled
   - Monitor recovery time

4. **Resolution Latency**
   - Track resolution time
   - Alert if > 100ms
   - Monitor cache performance

5. **Analysis Quality**
   - Track feedback ratings by engine
   - Alert if engine rating < 3.0
   - Monitor for performance regression

### Alert Rules

```yaml
alerts:
  - name: HighFallbackRate
    condition: fallback_rate > 0.1
    severity: warning
    
  - name: PrimaryEngineDisabled
    condition: primary_engine.enabled == false
    severity: critical
    
  - name: AllEnginesDisabled
    condition: enabled_engines == 0
    severity: critical
    
  - name: SlowResolution
    condition: resolution_latency_p99 > 100ms
    severity: warning
    
  - name: LowEngineRating
    condition: engine_rating < 3.0
    severity: warning
```

## Deployment Checklist

Before deploying multi-engine AI to production:

- [ ] All unit tests passing (939+)
- [ ] Engine resolver tested with all conditions
- [ ] Routing rules validated for all use cases
- [ ] Fallback logic verified
- [ ] Load testing completed
- [ ] Performance benchmarks met
- [ ] Monitoring and alerts configured
- [ ] Runbook documented
- [ ] Rollback procedure tested
- [ ] Team trained on new system

## Troubleshooting Guide

### Issue: Engine Always Selecting Primary

**Symptoms**: All resolutions return primary engine

**Diagnosis**:
1. Check if routing rules exist: `SELECT COUNT(*) FROM ai_routing_rules WHERE org_id = ?`
2. Check if rules are enabled: `SELECT * FROM ai_routing_rules WHERE org_id = ? AND enabled = true`
3. Check if target engines exist and are enabled
4. Check cache: `redis-cli KEYS "engine:*"`

**Solutions**:
- Create routing rules
- Enable disabled rules
- Enable target engines
- Clear cache: `redis-cli FLUSHDB`

### Issue: Inconsistent Engine Selection

**Symptoms**: Same request returns different engines

**Diagnosis**:
1. Check cache TTL: Should be 60 seconds
2. Check rule priority: Should be deterministic
3. Check for concurrent updates

**Solutions**:
- Verify cache is working
- Check rule priority ordering
- Ensure atomic rule updates
- Increase cache TTL if needed

### Issue: High Fallback Rate

**Symptoms**: > 10% of requests falling back to primary

**Diagnosis**:
1. Check rule conditions: Are they too restrictive?
2. Check token estimation: Is it accurate?
3. Check engine availability: Are target engines enabled?

**Solutions**:
- Review and adjust rule conditions
- Verify token estimation logic
- Enable disabled engines
- Add more general rules

## References

- [AI_ENGINES.md](./AI_ENGINES.md) - Engine configuration guide
- [DRIVE_AI.md](./DRIVE_AI.md) - Drive AI analysis documentation
- [OPERATIONS.md](./OPERATIONS.md) - Operations runbook
