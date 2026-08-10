import { GovernanceStore } from './store';
import type { ActionType } from '../types';
import type { KillSwitch, KillSwitchScope, KillSwitchState } from './types';

export class KillSwitchService {
  constructor(private readonly store: GovernanceStore) {}

  state(input: { projectId: string | null; actionType: ActionType | string }): KillSwitchState {
    const now = Date.now();
    const switches = this.store.listKillSwitches(false).filter(item => {
      if (item.expiresAt && new Date(item.expiresAt).getTime() <= now) return false;
      if (item.scope === 'GLOBAL') return true;
      if (item.scope === 'PROJECT') return item.projectId === input.projectId;
      if (item.scope === 'ACTION_TYPE') return item.actionType === input.actionType;
      return false;
    });
    return { blocked: switches.length > 0, switches };
  }

  enable(input: {
    scope: KillSwitchScope;
    projectId?: string | null;
    actionType?: ActionType | null;
    reason: string;
    activatedBy: string;
    expiresAt?: string | null;
    evidenceReferences?: string[];
  }): KillSwitch {
    return this.store.saveKillSwitch({
      scope: input.scope,
      projectId: input.projectId ?? null,
      actionType: input.actionType ?? null,
      enabled: true,
      reason: input.reason,
      activatedBy: input.activatedBy,
      expiresAt: input.expiresAt ?? null,
      evidenceReferences: input.evidenceReferences ?? [],
    });
  }

  lockdown(actor = 'cli-user', reason = 'Emergency lockdown enabled from local CLI.'): KillSwitch {
    return this.enable({ scope: 'GLOBAL', reason, activatedBy: actor, evidenceReferences: ['cli:personal-os actions lockdown'] });
  }

  unlock(id: string): KillSwitch {
    return this.store.disableKillSwitch(id);
  }
}
