import { execSync } from 'child_process';

// Get arguments
const network = process.env.NETWORK || 'localhost';
const startStep = parseInt(process.env.START_STEP || '1');
const endStep = parseInt(process.env.END_STEP || '6');

console.log(`Deploying to network: ${network}`);
console.log(`Steps: ${startStep} to ${endStep}`);

// Define deployment steps
const steps = [
    { script: './scripts/deploy-core.ts', name: 'Core Contracts' },
    { script: './scripts/deploy-achievements.ts', name: 'Achievements' },
    { script: './scripts/deploy-challenges.ts', name: 'Challenges' },
    { script: './scripts/deploy-expeditions.ts', name: 'Expeditions' },
    { script: './scripts/deploy-rewards.ts', name: 'Rewards System' },
    { script: './scripts/deploy-metadata.ts', name: 'Configure Metadata' }
];

// Execute deployment steps
for (let i = startStep - 1; i < Math.min(endStep, steps.length); i++) {
    const step = steps[i];
    console.log(`\n=== Executing Step ${i + 1}: ${step.name} ===`);

    try {
        execSync(`npx hardhat run ${step.script} --network ${network}`, { stdio: 'inherit' });
        console.log(`Step ${i + 1} completed successfully`);
    } catch (error) {
        console.error(`Step ${i + 1} failed:`, error);
        process.exit(1);
    }
}

console.log('\nDeployment completed successfully!');