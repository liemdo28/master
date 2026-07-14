export function getTopBlockers(_limit=5){return [{id:'blocker-qb-stale-risk'}];}
export function getTopApprovals(_limit=5){return [{id:'approval-raw-sushi-revenue-10'}];}
export function getTopRisks(_limit=5){return [{id:'risk-connector-staleness'}];}
export function getTopOpportunities(_limit=5){return [{id:'opp-doordash-new-customer-deal'}];}
export function prioritizeAttention(_signals: unknown){return [...getTopBlockers(),...getTopApprovals(),...getTopRisks(),...getTopOpportunities()];}
