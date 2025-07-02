import { Provider, Signer } from 'ethers';
import { DeploymentErrorHandler } from '../utils/error-handler';

export interface DeploymentState {
  network: string;
  phase: DeploymentPhase;
  stepIndex: number;
  deployedContracts: Record<string, ContractDeployment>;
  configurationSteps: Record<string, boolean>;
  gasUsed: bigint;
  startTime: Date;
  checkpoints: DeploymentCheckpoint[];
  lastCheckpoint?: string;
}

export interface ContractDeployment {
  address: string;
  implementation?: string;
  proxy?: string;
  verified: boolean;
  gasUsed: bigint;
  blockNumber: number;
  timestamp: Date;
  transactionHash: string;
}

export interface DeploymentCheckpoint {
  id: string;
  phase: DeploymentPhase;
  timestamp: Date;
  deployedContracts: string[];
  nextSteps: DeploymentStep[];
  rollbackInstructions: RollbackStep[];
  gasUsed: bigint;
}

export interface DeploymentStep {
  id: string;
  name: string;
  phase: DeploymentPhase;
  dependencies: string[];
  optional: boolean;
  gasEstimate?: bigint;
  retryable: boolean;
}

export interface RollbackStep {
  stepId: string;
  action: 'destroy' | 'revert' | 'skip';
  target: string;
  reason: string;
}

export enum DeploymentPhase {
  INFRASTRUCTURE = 'infrastructure',
  CORE_IMPLEMENTATIONS = 'core-implementations', 
  PROXY_DEPLOYMENTS = 'proxy-deployments',
  CONTRACT_INITIALIZATION = 'contract-initialization',
  AUTHORIZATION_CONFIG = 'authorization-config',
  TOKEN_ALLOCATIONS = 'token-allocations',
  GAME_LOGIC_SETUP = 'game-logic-setup',
  ACHIEVEMENTS_CONFIG = 'achievements-config',
  CHALLENGES_CONFIG = 'challenges-config',
  EXPEDITIONS_CONFIG = 'expeditions-config',
  REWARDS_CONFIG = 'rewards-config',
  METADATA_CONFIG = 'metadata-config',
  VERIFICATION = 'verification'
}

export interface DeploymentOptions {
  network: string;
  fromPhase?: DeploymentPhase;
  toPhase?: DeploymentPhase;
  skipDeployed?: boolean;
  resumeFromCheckpoint?: string;
  gasLimit?: bigint;
  maxGasPrice?: bigint;
  retryAttempts?: number;
  interactiveMode?: boolean;
  dryRun?: boolean;
  forceFresh?: boolean;
}

export interface DeploymentResult {
  success: boolean;
  deployedContracts: Record<string, string>;
  totalGasUsed: bigint;
  duration: number;
  errors: DeploymentError[];
  checkpoints: string[];
}

export interface DeploymentError {
  type: 'NETWORK_ERROR' | 'GAS_LIMIT_EXCEEDED' | 'CONTRACT_VERIFICATION_FAILED' | 'DEPENDENCY_MISSING' | 'AUTHORIZATION_FAILED' | 'UNKNOWN';
  message: string;
  step: string;
  phase: DeploymentPhase;
  transactionHash?: string;
  gasUsed?: bigint;
  timestamp: Date;
  retryable: boolean;
}

export interface GasEstimate {
  phase: DeploymentPhase;
  totalGas: bigint;
  stepEstimates: Record<string, bigint>;
  networkGasPrice: bigint;
  totalCost: bigint;
  confidence: number;
}

export interface DeploymentContext {
  options: DeploymentOptions;
  state: DeploymentState;
  currentStep: DeploymentStep;
  signer: Signer;
  provider: Provider;
  errorHandler: DeploymentErrorHandler;
}

export interface BatchTransaction {
  to: string;
  data: string;
  value?: bigint;
  gasLimit?: bigint;
}

export interface BatchResult {
  success: boolean;
  transactionHash: string;
  gasUsed: bigint;
  failures: number[];
}