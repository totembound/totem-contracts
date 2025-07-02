import { ethers } from "hardhat";
import { 
  DeploymentState, 
  DeploymentOptions, 
  DeploymentResult, 
  DeploymentPhase, 
  DeploymentContext
} from "./types/deployment";
import { GasOptimizer } from "./utils/gas-optimizer";
import { CheckpointManager } from "./utils/checkpoint-manager";
import { DeploymentErrorHandler } from "./utils/error-handler";
import { saveDeployment } from "./helpers";

// Phase imports
import { deployInfrastructure, getInfrastructureSteps } from "./phases/phase-1-infrastructure";
import { deployCoreImplementations, getCoreImplementationSteps } from "./phases/phase-2-core-implementations";
import { deployProxies, getProxyDeploymentSteps } from "./phases/phase-3-proxy-deployments";
import { configureAuthorizations, getAuthorizationSteps } from "./phases/phase-4-authorization-config";
import { configureTokenAllocations, getTokenAllocationSteps } from "./phases/phase-5-token-allocations";
import { setupGameLogic, getGameLogicSteps } from "./phases/phase-6-game-logic-setup";
import { configureAchievements, getAchievementsConfigSteps } from "./phases/phase-7-achievements-config";
import { configureChallenges, getChallengesConfigSteps } from "./phases/phase-8-challenges-config";
import { configureExpeditions, getExpeditionsConfigSteps } from "./phases/phase-9-expeditions-config";
import { configureRewards, getRewardsConfigSteps } from "./phases/phase-10-rewards-config";
import { configureMetadata, getMetadataConfigSteps } from "./phases/phase-11-metadata-config";

export class EnhancedDeployer {
  private gasOptimizer: GasOptimizer;
  private checkpointManager: CheckpointManager;
  private errorHandler: DeploymentErrorHandler;
  private state: DeploymentState;

  constructor(options: DeploymentOptions) {
    const provider = ethers.provider;
    this.gasOptimizer = new GasOptimizer(provider);
    this.checkpointManager = new CheckpointManager(options.network);
    this.errorHandler = new DeploymentErrorHandler({
      maxAttempts: options.retryAttempts || 3,
      retryableErrors: ['NETWORK_ERROR', 'GAS_LIMIT_EXCEEDED']
    });

    this.state = {
      network: options.network,
      phase: DeploymentPhase.INFRASTRUCTURE,
      stepIndex: 0,
      deployedContracts: {},
      configurationSteps: {},
      gasUsed: 0n,
      startTime: new Date(),
      checkpoints: []
    };
  }

  async deploy(options: DeploymentOptions): Promise<DeploymentResult> {
    console.log("\n🚀 Enhanced Deployment System Started");
    console.log("====================================");
    console.log(`Network: ${options.network}`);
    console.log(`Gas Limit: ${options.gasLimit ? options.gasLimit.toString() : 'auto'}`);
    console.log(`Retry Attempts: ${options.retryAttempts || 3}`);
    
    const startTime = Date.now();
    const [signer] = await ethers.getSigners();
    
    await this.checkpointManager.initialize();
    const address = await signer.getAddress();

    console.log(`Deployer: ${address}`);
    console.log(`Balance: ${ethers.formatEther(await signer.provider.getBalance(address))} ETH`);

    const context: DeploymentContext = {
      options,
      state: this.state,
      currentStep: { id: '', name: '', phase: DeploymentPhase.INFRASTRUCTURE, dependencies: [], optional: false, retryable: true },
      signer,
      provider: ethers.provider,
      errorHandler: this.errorHandler
    };

    try {
      // Execute deployment phases
      await this.executePhases(context, options);
      
      // Final verification and save
      await this.finalizeDeployment(context);
      
      const duration = Date.now() - startTime;
      const result: DeploymentResult = {
        success: true,
        deployedContracts: Object.fromEntries(
          Object.entries(this.state.deployedContracts).map(([k, v]) => [k, v.address])
        ),
        totalGasUsed: this.state.gasUsed,
        duration,
        errors: this.errorHandler.getErrorHistory(),
        checkpoints: this.state.checkpoints.map(cp => cp.id)
      };

      console.log("\n🎉 Deployment completed successfully!");
      console.log(`⏱️  Total time: ${Math.round(duration / 1000)}s`);
      console.log(`⛽ Total gas used: ${this.state.gasUsed.toLocaleString()}`);
      console.log(`📍 Checkpoints created: ${this.state.checkpoints.length}`);

      return result;

    } catch (error) {
      console.error("\n❌ Deployment failed:", error);
      
      // Save state for recovery
      await this.checkpointManager.saveState(this.state);
      
      return {
        success: false,
        deployedContracts: Object.fromEntries(
          Object.entries(this.state.deployedContracts).map(([k, v]) => [k, v.address])
        ),
        totalGasUsed: this.state.gasUsed,
        duration: Date.now() - startTime,
        errors: this.errorHandler.getErrorHistory(),
        checkpoints: this.state.checkpoints.map(cp => cp.id)
      };
    }
  }

  async resume(checkpointId?: string): Promise<DeploymentResult> {
    console.log("\n🔄 Resuming deployment from checkpoint");
    
    const resumeData = await this.checkpointManager.resumeFromCheckpoint(checkpointId);
    if (!resumeData) {
      throw new Error("No checkpoint found to resume from");
    }

    this.state = resumeData.state;
    console.log(`📍 Resuming from: ${resumeData.checkpoint.id}`);
    console.log(`🎯 Phase: ${resumeData.state.phase}`);

    // Create options from state
    const options: DeploymentOptions = {
      network: this.state.network,
      fromPhase: this.state.phase,
      resumeFromCheckpoint: resumeData.checkpoint.id
    };

    return this.deploy(options);
  }

  private async executePhases(context: DeploymentContext, options: DeploymentOptions): Promise<void> {
    const phases = [
      { phase: DeploymentPhase.INFRASTRUCTURE, executor: deployInfrastructure, steps: getInfrastructureSteps() },
      { phase: DeploymentPhase.CORE_IMPLEMENTATIONS, executor: deployCoreImplementations, steps: getCoreImplementationSteps() },
      { phase: DeploymentPhase.PROXY_DEPLOYMENTS, executor: deployProxies, steps: getProxyDeploymentSteps() },
      { phase: DeploymentPhase.AUTHORIZATION_CONFIG, executor: configureAuthorizations, steps: getAuthorizationSteps() },
      { phase: DeploymentPhase.TOKEN_ALLOCATIONS, executor: configureTokenAllocations, steps: getTokenAllocationSteps() },
      { phase: DeploymentPhase.GAME_LOGIC_SETUP, executor: setupGameLogic, steps: getGameLogicSteps() },
      { phase: DeploymentPhase.ACHIEVEMENTS_CONFIG, executor: configureAchievements, steps: getAchievementsConfigSteps() },
      { phase: DeploymentPhase.CHALLENGES_CONFIG, executor: configureChallenges, steps: getChallengesConfigSteps() },
      { phase: DeploymentPhase.EXPEDITIONS_CONFIG, executor: configureExpeditions, steps: getExpeditionsConfigSteps() },
      { phase: DeploymentPhase.REWARDS_CONFIG, executor: configureRewards, steps: getRewardsConfigSteps() },
      { phase: DeploymentPhase.METADATA_CONFIG, executor: configureMetadata, steps: getMetadataConfigSteps() }
    ];

    // Skip phases if resuming
    const startPhaseIndex = options.fromPhase ? 
      Math.max(0, phases.findIndex(p => p.phase === options.fromPhase)) : 0;

    for (let i = startPhaseIndex; i < phases.length; i++) {
      const { phase, executor, steps } = phases[i];
      
      // Skip if options specify to/from phases
      if (options.toPhase && phase > options.toPhase) break;
      if (options.fromPhase && phase < options.fromPhase) continue;

      this.state.phase = phase;
      
      // Create checkpoint before phase
      const checkpointId = CheckpointManager.generateCheckpointId(phase, 'start');
      await this.checkpointManager.createCheckpoint(this.state, checkpointId, steps);
      
      // Execute phase with gas estimation
      if (!options.dryRun) {
        await this.executePhaseWithOptimization(context, executor, phase);
      } else {
        console.log(`🔍 Dry run: ${phase} (skipped)`);
      }
      
      // Save state after phase
      await this.checkpointManager.saveState(this.state);
    }
  }

  private async executePhaseWithOptimization(
    context: DeploymentContext, 
    executor: (ctx: DeploymentContext) => Promise<void>,
    phase: DeploymentPhase
  ): Promise<void> {
    
    // Estimate gas for phase
    try {
      console.log(`⛽ Estimating gas for ${phase}...`);
      const gasPrice = await this.gasOptimizer.optimizeGasPrice();
      console.log(`💰 Optimized gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    } catch (error) {
      console.warn("Gas estimation failed, proceeding with defaults");
    }

    // Execute phase
    await executor(context);
    
    // Create checkpoint after successful phase
    const checkpointId = CheckpointManager.generateCheckpointId(phase, 'complete');
    await this.checkpointManager.createCheckpoint(this.state, checkpointId, []);
  }

  private async finalizeDeployment(context: DeploymentContext): Promise<void> {
    console.log("\n📋 Finalizing deployment...");
    
    // Verify balances and setup
    const { signer } = context;
    const gameProxy = this.state.deployedContracts["gameProxy"];
    const rewardsProxy = this.state.deployedContracts["rewardsProxy"];
    const tokenProxy = this.state.deployedContracts["tokenProxy"];
    const address = await signer.getAddress();

    if (gameProxy && rewardsProxy && tokenProxy) {
      const token = await ethers.getContractAt("TotemToken", tokenProxy.address, signer);
      const gameBalance = await token.balanceOf(gameProxy.address);
      const rewardsBalance = await token.balanceOf(rewardsProxy.address);
      
      console.log(`🎮 Game TOTEM Balance: ${ethers.formatEther(gameBalance)}`);
      console.log(`🎁 Rewards TOTEM Balance: ${ethers.formatEther(rewardsBalance)}`);
    }

    // Save deployment info
    const deploymentInfo = Object.fromEntries(
      Object.entries(this.state.deployedContracts).map(([key, contract]) => [
        key,
        contract.address
      ])
    );
    
    saveDeployment(this.state.network, {
      network: this.state.network,
      deployer: address,
      timestamp: new Date().toISOString(),
      ...deploymentInfo
    });

    console.log("✅ Deployment info saved");
  }

  // Static helper methods
  static async canResume(network: string): Promise<boolean> {
    const checkpointManager = new CheckpointManager(network);
    return checkpointManager.canResume();
  }

  static async listCheckpoints(network: string): Promise<string[]> {
    const checkpointManager = new CheckpointManager(network);
    return checkpointManager.listCheckpoints();
  }

  static async getDeploymentSummary(network: string): Promise<any> {
    const checkpointManager = new CheckpointManager(network);
    const state = await checkpointManager.loadState();
    
    if (!state) return null;
    
    return {
      network: state.network,
      phase: state.phase,
      contractsDeployed: Object.keys(state.deployedContracts).length,
      totalGasUsed: state.gasUsed.toString(),
      startTime: state.startTime,
      checkpoints: state.checkpoints.length
    };
  }
}