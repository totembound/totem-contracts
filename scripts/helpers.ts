import * as fs from 'fs';
import * as path from 'path';

export function saveDeployment(network: string, deploymentInfo: any) {
    const deploymentsDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir);
    }

    const filePath = path.join(deploymentsDir, `${network}.json`);
    fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`Deployment info saved to ${filePath}`);
}

export function loadDeployment(network: string) {
    const filePath = path.join(__dirname, '../deployments', `${network}.json`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`No deployment found for network ${network}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
