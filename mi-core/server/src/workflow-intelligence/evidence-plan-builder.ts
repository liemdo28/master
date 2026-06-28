/**
 * evidence-plan-builder.ts — declare what evidence each workflow step must produce.
 *
 * Every step gets a required evidence type so the executive report is backed by
 * proof, not assertion.
 */

export interface EvidenceRequirement {
  step: string;
  division: string;
  evidenceType: 'api-output' | 'screenshot' | 'dataset' | 'approval-token' | 'report';
  description: string;
}

export function buildEvidencePlan(steps: Array<{ title: string; division: string; gate: string }>): EvidenceRequirement[] {
  return steps.map((s) => {
    let evidenceType: EvidenceRequirement['evidenceType'] = 'api-output';
    if (s.gate === 'production_token') evidenceType = 'approval-token';
    else if (s.division === 'creative') evidenceType = 'screenshot';
    else if (s.division === 'data-platform' || s.division === 'finance') evidenceType = 'dataset';
    return {
      step: s.title,
      division: s.division,
      evidenceType,
      description: `${s.title} must produce ${evidenceType} evidence before completion`,
    };
  });
}
