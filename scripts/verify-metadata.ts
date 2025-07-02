import { ethers, network } from "hardhat";
import { loadDeployment } from "./helpers";
import { TotemGame, TotemNFT, TotemShop } from "../typechain-types";
import { species, colors, stages, ipfsHashes } from "./totem-metadata";

async function main() {
    const networkName = network.name;
    const deployment = loadDeployment(networkName);

    const game = await ethers.getContractAt(
        "TotemGame",
        deployment.gameProxy
    ) as unknown as TotemGame;

    const nft = await ethers.getContractAt(
        "TotemNFT",
        deployment.nftProxy
    ) as unknown as TotemNFT;

    const shop = await ethers.getContractAt(
        "TotemShop",
        deployment.shopProxy
    ) as unknown as TotemShop;

    // Verify each combination
    console.log("Verifying Totem Metadata...\n");

    try {
        for (let i = 0; i < species.length; i++) {
            console.log(`\nVerifying combination ${i}:`);
            console.log(`Species: ${species[i]}, Color: ${colors[i]}, Stage: ${stages[i]}`);
            
            const uri = await nft.getMetadataURI(
                species[i],
                colors[i],
                stages[i]
            );
            console.log("URI:", uri);
        }
    }
    catch (error) {
        console.error("Error verifying URIs:", error);
        // Try to get more information
        const currentOwner = await nft.owner();
        console.log("\nDiagnostic info:");
        console.log("NFT Owner:", currentOwner);
        console.log("Game Proxy:", deployment.gameProxy);
    }

    // Verify bundles were created
    console.log("\nVerifying bundles...");

    for(let i = 0; i < 4; i++) {
        const bundle = await shop.bundles(i);
        console.log(`Bundle ${i}:`);
        console.log(`- POL Cost: ${ethers.formatEther(bundle.polCost)} POL`);
        console.log(`- TOTEM Amount: ${ethers.formatEther(bundle.tokenAmount)} TOTEM`);
        console.log(`- Species: ${bundle.species}`);
        console.log(`- Color: ${bundle.color}`);
        console.log(`- Rarity Range: ${bundle.minRarity} to ${bundle.maxRarity}`);
        console.log(`- Is Limited: ${bundle.isLimitedRarity}`);
        if (bundle.validUntil === 0n) {
            console.log(`- Valid Until: Never expires\n`);
        } else {
            const expiryDate = new Date(Number(bundle.validUntil) * 1000);
            console.log(`- Valid Until: ${expiryDate.toISOString()} (UTC)\n`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });