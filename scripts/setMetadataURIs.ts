import { ethers } from "hardhat";
import { loadDeployment } from "./helpers"; // Adjust the relative path based on your folder structure
import { TotemGame, TotemNFT } from "../typechain-types"; // Adjust based on your typechain output directory

async function main() {
    const deployment = loadDeployment("localhost");
    console.log("Loading contracts...\n");
  
    const game = await ethers.getContractAt(
        "TotemGame",
        deployment.gameProxy
    ) as unknown as TotemGame;

    const nft = await ethers.getContractAt(
        "TotemNFT",
        deployment.totemNFT
    ) as unknown as TotemNFT;

    // Define metadata URIs for the Common Gray Owl
    const species: number[] = [11, 11, 11, 11, 11]; // Assuming "11" represents the Owl species
    const colors:  number[] = [1, 1, 1, 1, 1];      // Assuming "1" represents the Gray color
    const stages:  number[] = [0, 1, 2, 3, 4];      // Stages 0 to 4
    const ipfsHashes: string[] = [
        "bafkreigrnsrs6ws2bfwidt2mptwdprys6vd2rosgfwmt4soh73aennxuhy",
        "bafkreih7zork3eplxmcuugxgflcqrao2mo4x5m2hadyxobo35kgwzvo52u",
        "bafkreiaqgvynhteanlwb2pfec6xpm34kphdsle32pyzsilnzqvtmvtfray",
        "bafkreiggplwi3phuzstkmxlxxv2lckmw46zpi2tzextfqypxdnq4minl54",
        "bafkreica62x65foafho3u5wpic6uwsopvw35iaydjjwkb2o2ray32yfgnu",
    ];

    // Ensure array lengths match
    if (species.length !== colors.length || 
        colors.length !== stages.length || 
        stages.length !== ipfsHashes.length) {
        throw new Error("Array lengths do not match");
    }

    // Call through the game contract
    console.log("Setting metadata URIs through game contract...");
    const tx = await game.setMetadataURIs(species, colors, stages, ipfsHashes);
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("Metadata URIs have been set successfully!");

    // Look for MetadataURISet events
    console.log("\nChecking emitted events:");
    const metadataEvents = receipt?.logs
        .filter(log => {
            try {
                return nft.interface.parseLog(log)?.name === 'MetadataURISet';
            }
            catch {
                return false;
            }
        })
        .map(log => {
            const parsed = nft.interface.parseLog(log);
            return {
                species: parsed?.args.species,
                color: parsed?.args.color,
                stage: parsed?.args.stage,
                uri: parsed?.args.uri
            };
        });

    if (metadataEvents && metadataEvents.length > 0) {
        console.log("\nMetadata URIs set:");
        metadataEvents?.forEach((event, i) => {
            console.log(`\nCombination ${i}:`);
            console.log(`Species: ${event.species}`);
            console.log(`Color: ${event.color}`);
            console.log(`Stage: ${event.stage}`);
            console.log(`URI: ${event.uri}`);
        });
    }
    else {
        console.log("No MetadataURISet events found!");
    }

     // Verify each combination
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
        
        // Try direct verification of metadata storage
        try {
            // If your NFT contract has a way to directly check the stored hash
            // Add that verification here
            console.log("\nAttempting direct metadata check...");
        } catch (innerError) {
            console.error("Error in direct check:", innerError);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });