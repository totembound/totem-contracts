import { ethers, ContractFactory } from 'ethers';
import { DeploymentPhase, GasEstimate, BatchTransaction, BatchResult } from '../types/deployment';

export class GasOptimizer {
  private provider: ethers.Provider;
  private gasHistory: bigint[] = [];
  private readonly SAFETY_MARGIN = 120n; // 20% safety margin
  private readonly BATCH_SIZE = 10;

  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }

  async estimateDeploymentCost(
    phase: DeploymentPhase,
    factories: Record<string, ContractFactory>,
    constructorArgs: Record<string, any[]>
  ): Promise<GasEstimate> {
    const stepEstimates: Record<string, bigint> = {};
    let totalGas = 0n;

    for (const [contractName, factory] of Object.entries(factories)) {
      const args = constructorArgs[contractName] || [];
      try {
        const deployTx = await factory.getDeployTransaction(...args);
        const estimate = await this.provider.estimateGas(deployTx);
        const safeEstimate = (estimate * this.SAFETY_MARGIN) / 100n;
        stepEstimates[contractName] = safeEstimate;
        totalGas += safeEstimate;
      } catch (error) {
        // Fallback estimation for complex contracts
        stepEstimates[contractName] = BigInt(factory.bytecode.length / 2 * 21);
        totalGas += stepEstimates[contractName];
      }
    }

    const gasPrice = await this.optimizeGasPrice();
    
    return {
      phase,
      totalGas,
      stepEstimates,
      networkGasPrice: gasPrice,
      totalCost: totalGas * gasPrice,
      confidence: this.calculateConfidence(stepEstimates)
    };
  }

  async optimizeGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.provider.getFeeData();
      const currentGasPrice = feeData.gasPrice || 0n;
      
      // For EIP-1559 networks, use maxFeePerGas
      if (feeData.maxFeePerGas) {
        const optimized = this.calculateOptimalFee(feeData.maxFeePerGas, feeData.maxPriorityFeePerGas || 0n);
        return optimized;
      }

      // Legacy gas pricing with historical analysis
      return this.optimizeLegacyGasPrice(currentGasPrice);
    } catch (error) {
      console.warn('Gas price optimization failed, using default');
      return ethers.parseUnits('20', 'gwei'); // Fallback
    }
  }

  async batchTransactions(transactions: BatchTransaction[]): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    const batches = this.chunkArray(transactions, this.BATCH_SIZE);

    for (const batch of batches) {
      try {
        // For simple batching, execute transactions sequentially with optimized gas
        const batchResults = await Promise.allSettled(
          batch.map(tx => this.executeBatchedTransaction(tx))
        );

        results.push(...this.processBatchResults(batchResults));
      } catch (error) {
        console.error('Batch execution failed:', error);
        // Add failed batch results
        results.push(...batch.map(() => ({
          success: false,
          transactionHash: '',
          gasUsed: 0n,
          failures: [0]
        })));
      }
    }

    return results;
  }

  async estimateContractGas(
    factory: ContractFactory,
    constructorArgs: any[] = []
  ): Promise<bigint> {
    try {
      const deployTx = await factory.getDeployTransaction(...constructorArgs);
      const estimate = await this.provider.estimateGas(deployTx);
      return (estimate * this.SAFETY_MARGIN) / 100n;
    } catch (error) {
      // Fallback to bytecode-based estimation
      return BigInt(factory.bytecode.length / 2 * 21);
    }
  }

  async waitForOptimalGasPrice(maxGasPrice: bigint, timeoutMs: number = 300000): Promise<bigint> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const currentPrice = await this.optimizeGasPrice();
      if (currentPrice <= maxGasPrice) {
        return currentPrice;
      }
      
      // Wait 30 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
    
    // Return current price even if not optimal
    return this.optimizeGasPrice();
  }

  private calculateOptimalFee(maxFeePerGas: bigint, maxPriorityFeePerGas: bigint): bigint {
    // Conservative approach: use 90% of maxFeePerGas
    return (maxFeePerGas * 90n) / 100n;
  }

  private optimizeLegacyGasPrice(currentGasPrice: bigint): bigint {
    if (this.gasHistory.length === 0) {
      this.gasHistory.push(currentGasPrice);
      return currentGasPrice;
    }

    // Simple moving average with trend analysis
    const avgGasPrice = this.gasHistory.reduce((a, b) => a + b) / BigInt(this.gasHistory.length);
    const optimizedPrice = (avgGasPrice + currentGasPrice) / 2n;
    
    this.gasHistory.push(currentGasPrice);
    if (this.gasHistory.length > 10) {
      this.gasHistory.shift(); // Keep only last 10 data points
    }

    return optimizedPrice;
  }

  private calculateConfidence(estimates: Record<string, bigint>): number {
    const values = Object.values(estimates);
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b) / BigInt(values.length);
    const variance = values.reduce((acc, val) => {
      const diff = Number(val - mean);
      return acc + diff * diff;
    }, 0) / values.length;

    // Higher variance = lower confidence
    const confidence = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / Number(mean)));
    return Math.round(confidence * 100) / 100;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async executeBatchedTransaction(tx: BatchTransaction): Promise<BatchResult> {
    // Placeholder for actual batch transaction execution
    // In practice, this would use a multicall contract or similar
    return {
      success: true,
      transactionHash: '0x' + '0'.repeat(64),
      gasUsed: tx.gasLimit || 21000n,
      failures: []
    };
  }

  private processBatchResults(results: PromiseSettledResult<BatchResult>[]): BatchResult[] {
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          transactionHash: '',
          gasUsed: 0n,
          failures: [index]
        };
      }
    });
  }

  // Utility method for gas monitoring
  trackGasUsage(contractName: string, gasUsed: bigint): void {
    console.log(`⛽ ${contractName}: ${gasUsed.toLocaleString()} gas`);
  }

  // Get gas usage summary
  getGasSummary(): { total: bigint; average: bigint } {
    if (this.gasHistory.length === 0) {
      return { total: 0n, average: 0n };
    }

    const total = this.gasHistory.reduce((a, b) => a + b, 0n);
    const average = total / BigInt(this.gasHistory.length);
    
    return { total, average };
  }
}

// Utility functions for gas optimization
export function formatGas(gas: bigint): string {
  return gas.toLocaleString();
}

export function formatGwei(wei: bigint): string {
  return ethers.formatUnits(wei, 'gwei') + ' gwei';
}

export function calculateGasCost(gasUsed: bigint, gasPrice: bigint): string {
  const costWei = gasUsed * gasPrice;
  return ethers.formatEther(costWei) + ' ETH';
}