import { ProjectRegistryService } from '../project-registry/service';
import { CodingWorkflow } from './workflow';

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (cmd === 'engines') {
    const { CODING_ENGINE_REGISTRY } = await import('./engine-registry');
    console.log(JSON.stringify(CODING_ENGINE_REGISTRY, null, 2));
    return;
  }
  if (cmd === 'models') {
    const { selectCodingModelRoles } = await import('./model-router');
    console.log(JSON.stringify(await selectCodingModelRoles(), null, 2));
    return;
  }
  if (cmd === 'run') {
    const [projectId, contextPackId, ...requestParts] = rest;
    const userRequest = requestParts.join(' ');
    if (!projectId || !contextPackId || !userRequest) {
      throw new Error('Usage: coding run <projectId> <contextPackId> <request>');
    }
    const service = new ProjectRegistryService();
    const project = service.getProject(projectId);
    if (!project) throw new Error(`project not found: ${projectId}`);
    const workflow = new CodingWorkflow(undefined, service);
    const result = await workflow.run({
      projectId,
      contextPackId,
      mapVersion: project.mapVersion,
      userRequest,
      commitPolicy: 'local-only',
    });
    console.log(JSON.stringify({
      taskId: result.task.id,
      status: result.task.status,
      commitSha: result.commitSha,
      review: result.review,
    }, null, 2));
    workflow.close();
    return;
  }
  throw new Error('Unknown command. Use: engines | models | run <projectId> <contextPackId> <request>');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
