import { ethers } from "hardhat";
import { loadDeployment } from "./helpers";
import { TotemGame, TotemToken, TotemTrustedForwarder } from "../typechain-types";

// Define the forward request type
type ForwardRequest = {
    from: string;
    to: string;
    value: bigint;
    gas: bigint;
    nonce: bigint;
    data: string;
};

async function main() {
    // Get deployment addresses
    const deployment = loadDeployment("localhost");
    
    // Get signers
    const [deployer, user] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    console.log("User address:", user.address);

    // Get contract instances with types
    const forwarder = await ethers.getContractAt(
        "TotemTrustedForwarder",
        deployment.totemTrustedForwarder
    ) as unknown as TotemTrustedForwarder;

    const game = await ethers.getContractAt(
        "TotemGame",
        deployment.gameProxy
    ) as unknown as TotemGame;

    const token = await ethers.getContractAt(
        "TotemToken",
        deployment.tokenProxy
    ) as unknown as TotemToken;

    // Get all initial balances
    const forwarderBalanceBefore = await ethers.provider.getBalance(forwarder.getAddress());
    const userBalanceBefore = await ethers.provider.getBalance(user.address);
    const deployerBalanceBefore = await ethers.provider.getBalance(deployer.address);
    
    console.log("\nInitial balances (POL):");
    console.log("Forwarder:", ethers.formatEther(forwarderBalanceBefore));
    console.log("User:", ethers.formatEther(userBalanceBefore));
    console.log("Deployer:", ethers.formatEther(deployerBalanceBefore));

    // Encode the signup function call directly
    const signupData = game.interface.encodeFunctionData("signup" as any, [] as any);

    // Create the forward request
    const request: ForwardRequest = {
        from: user.address,
        to: await game.getAddress(),
        value: BigInt(0),
        gas: BigInt(500000),  // Estimated gas
        nonce: await forwarder.getNonce(user.address),
        data: signupData
    };

    // Get domain data for signing
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = {
        name: "TotemTrustedForwarder",
        version: "1",
        chainId: chainId,
        verifyingContract: await forwarder.getAddress()
    };

    // Define the types for signing
    const types = {
        ForwardRequest: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "gas", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "data", type: "bytes" }
        ]
    };

    try {
        // Sign the request using ethers v6 method
        const signature = await user.signTypedData(domain, types, request);
        console.log("\nExecuting gasless transaction...");
        console.log("Transaction sender:", deployer.address);
        console.log("Actual user:", user.address);
        console.log("Forwarder address:", await forwarder.getAddress());

        // Execute the meta-transaction
        const tx = await forwarder.relay(request, signature);
        const receipt = await tx.wait();

        // Get all final balances
        const forwarderBalanceAfter = await ethers.provider.getBalance(forwarder.getAddress());
        const userBalanceAfter = await ethers.provider.getBalance(user.address);
        const deployerBalanceAfter = await ethers.provider.getBalance(deployer.address);

        // Calculate all balance changes
        const gasCost = receipt ? (receipt.gasUsed * (receipt.gasPrice || 0n)) : 0;
        const forwarderChange = forwarderBalanceAfter - forwarderBalanceBefore;
        const userChange = userBalanceAfter - userBalanceBefore;
        const deployerChange = deployerBalanceAfter - deployerBalanceBefore;
        
        console.log("\nTransaction details:");
        console.log("Transaction hash:", receipt?.hash);
        console.log("Block number:", receipt?.blockNumber);
        console.log("Gas used:", receipt?.gasUsed.toString(), "units");
        console.log("Gas price:", ethers.formatUnits(receipt?.gasPrice || 0n, "gwei"), "gwei");
        console.log("Total gas cost:", ethers.formatEther(gasCost), "POL");
        
        console.log("\nBalance changes (POL):");
        console.log("Forwarder change:", ethers.formatEther(forwarderChange));
        console.log("User change:", ethers.formatEther(userChange));
        console.log("Deployer change:", ethers.formatEther(deployerChange));

        // Check who paid
        console.log("\nWho paid for gas:");
        if (forwarderChange < 0n) console.log("- Forwarder paid", ethers.formatEther(-forwarderChange), "POL");
        if (userChange < 0n) console.log("- User paid", ethers.formatEther(-userChange), "POL");
        if (deployerChange < 0n) console.log("- Deployer paid", ethers.formatEther(-deployerChange), "POL");

        // Check for events
        const forwarderEvents = receipt?.logs
        .filter(log => log.address === deployment.totemTrustedForwarder)
        .map(log => {
            try {
                return forwarder.interface.parseLog(log);
            } catch (e) {
                return null;
            }
        })
        .filter(event => event !== null);
        console.log("\nForwarder events:", forwarderEvents);

    } catch (error) {
        console.error("Error executing gasless signup:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });