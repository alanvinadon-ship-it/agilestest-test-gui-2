/**
 * driveCorrelation/index.ts — Barrel exports
 * Mission DRIVE-CORRELATION-1
 */
export * from './types';
export { segmentRoute, enrichSamplesWithSegments, aggregateSegmentKpi, classifyBreach } from './segmentation';
export { buildArtifactTimeIndex, findArtifactsInWindow, findArtifactsForSegment } from './artifactIndex';
export { generateDriveIncidents, deduplicateIncidents, mergeContiguousIncidents } from './autoIncidents';
export { buildDriveRepairContext, simulateDriveRepair } from './driveRepairHook';
export type { DriveRepairContext } from './driveRepairHook';
export * from './driveRepairTypes';
export { buildDriveRepairContextV2, contextToPromptString } from './driveRepairContextBuilder';
export type { ContextBuilderInput } from './driveRepairContextBuilder';
export { simulateDriveRepairV2 } from './driveRepairSimulator';
