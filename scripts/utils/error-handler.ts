import { 
  DeploymentError, 
  DeploymentContext
} from '../types/deployment';

export enum ErrorHandlingStrategy {
  RETRY = 'retry',
  SKIP = 'skip',
  ABORT = 'abort',
  MANUAL = 'manual'
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export class DeploymentErrorHandler {
  private retryConfig: RetryConfig;
  private errorHistory: DeploymentError[] = [];

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: [
        'NETWORK_ERROR',
        'GAS_LIMIT_EXCEEDED',
        'REPLACEMENT_UNDERPRICED',
        'TIMEOUT'
      ],
      ...retryConfig
    };
  }

  async handleDeploymentError(
    error: Error,
    context: DeploymentContext,
    attempt: number = 1
  ): Promise<ErrorHandlingStrategy> {
    const deploymentError = this.categorizeError(error, context);
    this.errorHistory.push(deploymentError);

    console.error(`❌ Deployment error in ${context.currentStep.name}:`);
    console.error(`   Type: ${deploymentError.type}`);
    console.error(`   Message: ${deploymentError.message}`);
    console.error(`   Attempt: ${attempt}/${this.retryConfig.maxAttempts}`);

    // Determine handling strategy
    const strategy = await this.determineStrategy(deploymentError, context, attempt);
    
    switch (strategy) {
      case ErrorHandlingStrategy.RETRY:
        return this.handleRetry(deploymentError, context, attempt);
      
      case ErrorHandlingStrategy.SKIP:
        return this.handleSkip(deploymentError, context);
      
      case ErrorHandlingStrategy.MANUAL:
        return this.handleManualIntervention(deploymentError, context);
      
      default:
        return ErrorHandlingStrategy.ABORT;
    }
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: DeploymentContext,
    customConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customConfig };
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        // Log success after retry
        if (attempt > 1) {
          console.log(`✅ Operation succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        const strategy = await this.handleDeploymentError(lastError, context, attempt);
        
        if (strategy === ErrorHandlingStrategy.ABORT) {
          throw lastError;
        }
        
        if (strategy === ErrorHandlingStrategy.SKIP) {
          throw new SkipError('Operation skipped due to error handling strategy');
        }
        
        if (attempt < config.maxAttempts && strategy === ErrorHandlingStrategy.RETRY) {
          const delay = this.calculateDelay(attempt, config);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }
      }
    }

    // All attempts exhausted
    throw lastError!;
  }

  private categorizeError(error: Error, context: DeploymentContext): DeploymentError {
    const message = error.message.toLowerCase();
    let type: DeploymentError['type'] = 'UNKNOWN';
    let retryable = false;

    // Network-related errors
    if (message.includes('network') || message.includes('timeout') || 
        message.includes('connection') || message.includes('econnreset')) {
      type = 'NETWORK_ERROR';
      retryable = true;
    }
    // Gas-related errors
    else if (message.includes('gas') || message.includes('out of gas') ||
             message.includes('gas limit') || message.includes('underpriced')) {
      type = 'GAS_LIMIT_EXCEEDED';
      retryable = true;
    }
    // Contract verification errors
    else if (message.includes('verification') || message.includes('verify')) {
      type = 'CONTRACT_VERIFICATION_FAILED';
      retryable = false;
    }
    // Authorization errors
    else if (message.includes('unauthorized') || message.includes('access denied') ||
             message.includes('ownable') || message.includes('role')) {
      type = 'AUTHORIZATION_FAILED';
      retryable = false;
    }
    // Dependency errors
    else if (message.includes('not deployed') || message.includes('address') ||
             message.includes('contract not found')) {
      type = 'DEPENDENCY_MISSING';
      retryable = false;
    }

    return {
      type,
      message: error.message,
      step: context.currentStep.id,
      phase: context.currentStep.phase,
      timestamp: new Date(),
      retryable,
      gasUsed: this.extractGasUsed(error)
    };
  }

  private async determineStrategy(
    error: DeploymentError,
    context: DeploymentContext,
    attempt: number
  ): Promise<ErrorHandlingStrategy> {
    // Check if error is retryable and we haven't exceeded max attempts
    if (error.retryable && attempt < this.retryConfig.maxAttempts) {
      return ErrorHandlingStrategy.RETRY;
    }

    // Handle specific error types
    switch (error.type) {
      case 'CONTRACT_VERIFICATION_FAILED':
        // Verification failures can often be skipped
        if (context.options.dryRun || !context.options.interactiveMode) {
          console.warn('⚠️  Contract verification failed, but continuing deployment');
          return ErrorHandlingStrategy.SKIP;
        }
        return ErrorHandlingStrategy.MANUAL;

      case 'DEPENDENCY_MISSING':
        // Missing dependencies usually require manual intervention
        return ErrorHandlingStrategy.MANUAL;

      case 'AUTHORIZATION_FAILED':
        // Authorization failures might be recoverable with manual intervention
        return ErrorHandlingStrategy.MANUAL;

      case 'GAS_LIMIT_EXCEEDED':
        // If gas limit exceeded on final attempt, might need manual gas adjustment
        if (attempt >= this.retryConfig.maxAttempts) {
          return ErrorHandlingStrategy.MANUAL;
        }
        return ErrorHandlingStrategy.RETRY;

      default:
        // For unknown errors, try manual intervention if interactive mode
        if (context.options.interactiveMode) {
          return ErrorHandlingStrategy.MANUAL;
        }
        return ErrorHandlingStrategy.ABORT;
    }
  }

  private async handleRetry(
    error: DeploymentError,
    context: DeploymentContext,
    attempt: number
  ): Promise<ErrorHandlingStrategy> {
    console.log(`🔄 Retrying step: ${context.currentStep.name}`);
    
    // Apply specific retry strategies based on error type
    if (error.type === 'GAS_LIMIT_EXCEEDED') {
      await this.adjustGasSettings(context);
    } else if (error.type === 'NETWORK_ERROR') {
      await this.checkNetworkHealth(context);
    }

    return ErrorHandlingStrategy.RETRY;
  }

  private async handleSkip(
    error: DeploymentError,
    context: DeploymentContext
  ): Promise<ErrorHandlingStrategy> {
    console.warn(`⏭️  Skipping step: ${context.currentStep.name}`);
    console.warn(`   Reason: ${error.message}`);
    
    // Log skip for later review
    this.logSkippedStep(context.currentStep.id, error);
    
    return ErrorHandlingStrategy.SKIP;
  }

  private async handleManualIntervention(
    error: DeploymentError,
    context: DeploymentContext
  ): Promise<ErrorHandlingStrategy> {
    console.error(`🔧 Manual intervention required for: ${context.currentStep.name}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Suggestions:`);
    
    const suggestions = this.generateSuggestions(error, context);
    suggestions.forEach((suggestion, index) => {
      console.error(`   ${index + 1}. ${suggestion}`);
    });

    if (context.options.interactiveMode) {
      // In interactive mode, prompt user for action
      return await this.promptUserAction(error, context);
    }

    return ErrorHandlingStrategy.ABORT;
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelayMs);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractGasUsed(error: Error): bigint | undefined {
    // Try to extract gas used from error message
    const gasMatch = error.message.match(/gas used: (\d+)/i);
    return gasMatch ? BigInt(gasMatch[1]) : undefined;
  }

  private async adjustGasSettings(context: DeploymentContext): Promise<void> {
    console.log('⛽ Adjusting gas settings for retry...');
    // In practice, this would adjust gas limit/price in the context
    // For now, we just log the action
  }

  private async checkNetworkHealth(context: DeploymentContext): Promise<void> {
    console.log('🌐 Checking network connectivity...');
    try {
      const blockNumber = await context.provider.getBlockNumber();
      console.log(`   Current block: ${blockNumber}`);
    } catch (error) {
      console.warn('   Network connectivity issues detected');
    }
  }

  private logSkippedStep(stepId: string, error: DeploymentError): void {
    // Log skipped steps for later review
    console.warn(`📝 Logged skipped step: ${stepId} - ${error.type}`);
  }

  private generateSuggestions(error: DeploymentError, context: DeploymentContext): string[] {
    const suggestions: string[] = [];

    switch (error.type) {
      case 'GAS_LIMIT_EXCEEDED':
        suggestions.push('Increase gas limit in deployment options');
        suggestions.push('Wait for lower network congestion');
        suggestions.push('Consider deploying in smaller batches');
        break;

      case 'NETWORK_ERROR':
        suggestions.push('Check internet connectivity');
        suggestions.push('Verify RPC endpoint is responding');
        suggestions.push('Try a different RPC provider');
        break;

      case 'DEPENDENCY_MISSING':
        suggestions.push('Deploy missing dependencies first');
        suggestions.push('Verify contract addresses in configuration');
        suggestions.push('Check if contracts are deployed on correct network');
        break;

      case 'AUTHORIZATION_FAILED':
        suggestions.push('Verify account has necessary permissions');
        suggestions.push('Check if contracts are properly initialized');
        suggestions.push('Ensure correct signer is being used');
        break;

      default:
        suggestions.push('Review error details and deployment logs');
        suggestions.push('Check network status and gas prices');
        suggestions.push('Verify deployment configuration');
    }

    return suggestions;
  }

  private async promptUserAction(
    error: DeploymentError,
    context: DeploymentContext
  ): Promise<ErrorHandlingStrategy> {
    // In practice, this would use a CLI prompt library
    // For now, return a default strategy
    console.log('🤔 Interactive mode not fully implemented, defaulting to abort');
    return ErrorHandlingStrategy.ABORT;
  }

  // Public methods for error reporting
  getErrorHistory(): DeploymentError[] {
    return [...this.errorHistory];
  }

  getErrorSummary(): { total: number; byType: Record<string, number>; retryable: number } {
    const summary = {
      total: this.errorHistory.length,
      byType: {} as Record<string, number>,
      retryable: 0
    };

    this.errorHistory.forEach(error => {
      summary.byType[error.type] = (summary.byType[error.type] || 0) + 1;
      if (error.retryable) {
        summary.retryable++;
      }
    });

    return summary;
  }

  clearErrorHistory(): void {
    this.errorHistory = [];
  }
}

// Custom error for skipped operations
export class SkipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkipError';
  }
}

// Utility function for wrapping operations with error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: DeploymentContext,
  errorHandler: DeploymentErrorHandler
): Promise<T> {
  return errorHandler.executeWithRetry(operation, context);
}