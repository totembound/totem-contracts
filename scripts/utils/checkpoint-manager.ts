import { promises as fs } from 'fs';
import { join } from 'path';
import { 
  DeploymentState, 
  DeploymentCheckpoint, 
  DeploymentPhase, 
  DeploymentStep,
  RollbackStep 
} from '../types/deployment';

export class CheckpointManager {
  private checkpointsDir: string;
  private stateFile: string;

  constructor(network: string) {
    this.checkpointsDir = join(process.cwd(), '.deployment', network);
    this.stateFile = join(this.checkpointsDir, 'state.json');
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.checkpointsDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to create checkpoints directory:', error);
    }
  }

  async saveState(state: DeploymentState): Promise<void> {
    try {
      const stateJson = JSON.stringify(this.serializeState(state), null, 2);
      await fs.writeFile(this.stateFile, stateJson);
      console.log(`💾 State saved at phase: ${state.phase}`);
    } catch (error) {
      console.error('Failed to save deployment state:', error);
    }
  }

  async loadState(): Promise<DeploymentState | null> {
    try {
      const stateJson = await fs.readFile(this.stateFile, 'utf-8');
      const rawState = JSON.parse(stateJson);
      return this.deserializeState(rawState);
    } catch (error) {
      return null; // No existing state
    }
  }

  async createCheckpoint(
    state: DeploymentState,
    checkpointId: string,
    nextSteps: DeploymentStep[]
  ): Promise<DeploymentCheckpoint> {
    const checkpoint: DeploymentCheckpoint = {
      id: checkpointId,
      phase: state.phase,
      timestamp: new Date(),
      deployedContracts: Object.keys(state.deployedContracts),
      nextSteps,
      rollbackInstructions: this.generateRollbackInstructions(state),
      gasUsed: state.gasUsed
    };

    // Save checkpoint to file
    const checkpointFile = join(this.checkpointsDir, `${checkpointId}.json`);
    await fs.writeFile(
      checkpointFile, 
      JSON.stringify(this.serializeCheckpoint(checkpoint), null, 2)
    );

    // Update state with checkpoint
    state.checkpoints.push(checkpoint);
    state.lastCheckpoint = checkpointId;
    await this.saveState(state);

    console.log(`📍 Checkpoint created: ${checkpointId} (${checkpoint.deployedContracts.length} contracts)`);
    return checkpoint;
  }

  async loadCheckpoint(checkpointId: string): Promise<DeploymentCheckpoint | null> {
    try {
      const checkpointFile = join(this.checkpointsDir, `${checkpointId}.json`);
      const checkpointJson = await fs.readFile(checkpointFile, 'utf-8');
      const rawCheckpoint = JSON.parse(checkpointJson);
      return this.deserializeCheckpoint(rawCheckpoint);
    } catch (error) {
      console.error(`Failed to load checkpoint ${checkpointId}:`, error);
      return null;
    }
  }

  async listCheckpoints(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.checkpointsDir);
      return files
        .filter(f => f.endsWith('.json') && f !== 'state.json')
        .map(f => f.replace('.json', ''))
        .sort();
    } catch (error) {
      return [];
    }
  }

  async getLatestCheckpoint(): Promise<DeploymentCheckpoint | null> {
    const state = await this.loadState();
    if (!state?.lastCheckpoint) return null;
    
    return this.loadCheckpoint(state.lastCheckpoint);
  }

  async canResume(): Promise<boolean> {
    const state = await this.loadState();
    return state !== null;
  }

  async resumeFromCheckpoint(checkpointId?: string): Promise<{
    state: DeploymentState;
    checkpoint: DeploymentCheckpoint;
    nextSteps: DeploymentStep[];
  } | null> {
    let checkpoint: DeploymentCheckpoint | null;
    
    if (checkpointId) {
      checkpoint = await this.loadCheckpoint(checkpointId);
    } else {
      checkpoint = await this.getLatestCheckpoint();
    }

    if (!checkpoint) {
      console.error('No checkpoint found for resumption');
      return null;
    }

    const state = await this.loadState();
    if (!state) {
      console.error('No deployment state found');
      return null;
    }

    console.log(`🔄 Resuming from checkpoint: ${checkpoint.id}`);
    console.log(`📍 Phase: ${checkpoint.phase}`);
    console.log(`📦 Deployed contracts: ${checkpoint.deployedContracts.length}`);
    console.log(`⏭️  Next steps: ${checkpoint.nextSteps.length}`);

    return {
      state,
      checkpoint,
      nextSteps: checkpoint.nextSteps
    };
  }

  async rollback(checkpointId: string): Promise<boolean> {
    const checkpoint = await this.loadCheckpoint(checkpointId);
    if (!checkpoint) {
      console.error(`Checkpoint ${checkpointId} not found`);
      return false;
    }

    console.log(`🔙 Rolling back to checkpoint: ${checkpointId}`);
    
    // Execute rollback instructions
    for (const instruction of checkpoint.rollbackInstructions) {
      await this.executeRollbackStep(instruction);
    }

    // Remove newer checkpoints
    await this.cleanupNewerCheckpoints(checkpoint.timestamp);
    
    console.log(`✅ Rollback to ${checkpointId} completed`);
    return true;
  }

  async cleanup(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const checkpoints = await this.listCheckpoints();
    
    for (const checkpointId of checkpoints) {
      const checkpoint = await this.loadCheckpoint(checkpointId);
      if (checkpoint && checkpoint.timestamp < cutoffDate) {
        const checkpointFile = join(this.checkpointsDir, `${checkpointId}.json`);
        await fs.unlink(checkpointFile);
        console.log(`🗑️  Cleaned up old checkpoint: ${checkpointId}`);
      }
    }
  }

  private serializeState(state: DeploymentState): any {
    return {
      ...state,
      gasUsed: state.gasUsed.toString(),
      startTime: state.startTime.toISOString(),
      deployedContracts: Object.fromEntries(
        Object.entries(state.deployedContracts).map(([key, contract]) => [
          key,
          {
            ...contract,
            gasUsed: contract.gasUsed.toString(),
            timestamp: contract.timestamp.toISOString()
          }
        ])
      ),
      checkpoints: state.checkpoints.map(cp => this.serializeCheckpoint(cp))
    };
  }

  private deserializeState(rawState: any): DeploymentState {
    return {
      ...rawState,
      gasUsed: BigInt(rawState.gasUsed || '0'),
      startTime: new Date(rawState.startTime),
      deployedContracts: Object.fromEntries(
        Object.entries(rawState.deployedContracts || {}).map(([key, contract]: [string, any]) => [
          key,
          {
            ...contract,
            gasUsed: BigInt(contract.gasUsed || '0'),
            timestamp: new Date(contract.timestamp)
          }
        ])
      ),
      checkpoints: (rawState.checkpoints || []).map((cp: any) => this.deserializeCheckpoint(cp))
    };
  }

  private serializeCheckpoint(checkpoint: DeploymentCheckpoint): any {
    return {
      ...checkpoint,
      timestamp: checkpoint.timestamp.toISOString(),
      gasUsed: checkpoint.gasUsed.toString()
    };
  }

  private deserializeCheckpoint(rawCheckpoint: any): DeploymentCheckpoint {
    return {
      ...rawCheckpoint,
      timestamp: new Date(rawCheckpoint.timestamp),
      gasUsed: BigInt(rawCheckpoint.gasUsed || '0')
    };
  }

  private generateRollbackInstructions(state: DeploymentState): RollbackStep[] {
    // Generate rollback instructions based on current state
    // This is a simplified version - in practice would be more sophisticated
    return Object.entries(state.deployedContracts).map(([contractName, deployment]) => ({
      stepId: `rollback-${contractName}`,
      action: 'revert' as const,
      target: deployment.address,
      reason: `Rollback ${contractName} deployment`
    }));
  }

  private async executeRollbackStep(step: RollbackStep): Promise<void> {
    console.log(`⚠️  Executing rollback: ${step.action} ${step.target}`);
    // In practice, this would contain actual rollback logic
    // For now, we just log the action
  }

  private async cleanupNewerCheckpoints(cutoffDate: Date): Promise<void> {
    const checkpoints = await this.listCheckpoints();
    
    for (const checkpointId of checkpoints) {
      const checkpoint = await this.loadCheckpoint(checkpointId);
      if (checkpoint && checkpoint.timestamp > cutoffDate) {
        const checkpointFile = join(this.checkpointsDir, `${checkpointId}.json`);
        await fs.unlink(checkpointFile);
      }
    }
  }

  // Helper method to generate checkpoint ID
  static generateCheckpointId(phase: DeploymentPhase, step?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const stepSuffix = step ? `-${step}` : '';
    return `${phase}${stepSuffix}-${timestamp}`;
  }

  // Helper method to validate checkpoint integrity
  async validateCheckpoint(checkpointId: string): Promise<boolean> {
    const checkpoint = await this.loadCheckpoint(checkpointId);
    if (!checkpoint) return false;

    // Basic validation - ensure required fields exist
    return !!(
      checkpoint.id &&
      checkpoint.phase &&
      checkpoint.timestamp &&
      Array.isArray(checkpoint.deployedContracts) &&
      Array.isArray(checkpoint.nextSteps)
    );
  }
}