/**
 * Phase 7C — canonical service instances the Gateway orchestrates. One
 * singleton per subsystem, constructed the same way each subsystem's own
 * router already constructs it (see docs/architecture/PHASE7C_COMPONENT_AUDIT.md
 * §3's canonical-owner map). The Gateway never re-implements any of this
 * logic — it only calls these.
 */
import { PersonalOsService } from '../personal-os/service';
import { ProjectRegistryService } from '../project-registry/service';
import { TaskStore } from '../task-runtime/store';
import { TaskEngine } from '../task-runtime/engine';
import { GovernedOrchestrationService } from '../personal-os/orchestration/service';
import { AutomationSimulationService } from '../personal-os/automation-simulation/service';
import { ControlledActionService } from '../personal-os/actions/service';
import { OperatorControlService } from '../operator-control/service';
import { DocumentStore } from '../personal-os/documents/store';
import { KnowledgeRetrievalService } from '../personal-os/documents/retrieval';

export const projectRegistry = new ProjectRegistryService();
export const taskStore = new TaskStore();
export const taskEngine = new TaskEngine(taskStore);
export const personalOs = new PersonalOsService(undefined, taskStore, projectRegistry);
export const orchestration = new GovernedOrchestrationService();
export const simulation = new AutomationSimulationService();
export const controlledActions = new ControlledActionService();
export const operatorControl = new OperatorControlService();
export const documentStore = new DocumentStore();
export const knowledgeRetrieval = new KnowledgeRetrievalService(documentStore);
