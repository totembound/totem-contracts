// distributionHelper.ts
import { ethers } from "hardhat";
import { TotemNFT } from "../typechain-types";

export interface Distribution {
    rarity: { [key: string]: number };
    colors: { [key: string]: number };
    colorsByRarity: { [key: string]: { [key: string]: number } };
    total: number;
}

export async function mintAndAnalyzeDistribution(
    nft: TotemNFT, 
    numToMint: number,
    ownerAddress: string
): Promise<Distribution> {
    const distribution: Distribution = {
        rarity: {},
        colors: {},
        colorsByRarity: {},
        total: numToMint
    };

    // Rarity enum mapping
    const rarityMap: { [key: number]: string } = {
        0: "Common",
        1: "Uncommon",
        2: "Rare",
        3: "Epic",
        4: "Legendary"
    };

    // Color enum mapping
    const colorMap: { [key: number]: string } = {
        // Common Colors (0-3)
        0: "Brown",
        1: "Gray",
        2: "White",
        3: "Tawny",
        // Uncommon Colors (4-7)
        4: "Slate",
        5: "Copper",
        6: "Cream",
        7: "Dappled",
        // Rare Colors (8-10)
        8: "Golden",
        9: "DarkPurple",
        10: "Charcoal",
        // Epic Colors (11-13)
        11: "EmeraldGreen",
        12: "CrimsonRed",
        13: "DeepSapphire",
        // Legendary Colors (14-15)
        14: "RadiantGold",
        15: "EtherealSilver"
    };

    // Initialize counters
    Object.values(rarityMap).forEach(rarity => {
        distribution.rarity[rarity] = 0;
        distribution.colorsByRarity[rarity] = {};
    });

    Object.values(colorMap).forEach(color => {
        distribution.colors[color] = 0;
    });

    // Mint NFTs and collect data
    for (let i = 0; i < numToMint; i++) {
        // Mint with Species.Owl (11)
        const tx = await nft.mint(ownerAddress, 11);
        await tx.wait();
        
        const tokenId = i + 1;
        const attrs = await nft.attributes(tokenId);
        
        const rarityName = rarityMap[Number(attrs.rarity)];
        const colorName = colorMap[Number(attrs.color)];
        
        // Update counters
        distribution.rarity[rarityName]++;
        distribution.colors[colorName]++;
        
        if (!distribution.colorsByRarity[rarityName][colorName]) {
            distribution.colorsByRarity[rarityName][colorName] = 0;
        }
        distribution.colorsByRarity[rarityName][colorName]++;
    }

    return distribution;
}

export function formatDistribution(dist: Distribution): string {
    let output = `\nAnalysis of ${dist.total} minted NFTs:\n`;
    
    output += "\nRarity Distribution:";
    for (const [rarity, count] of Object.entries(dist.rarity)) {
        const percentage = ((count / dist.total) * 100).toFixed(2);
        output += `\n${rarity}: ${count} (${percentage}%)`;
    }
    
    output += "\n\nColor Distribution:";
    for (const [color, count] of Object.entries(dist.colors)) {
        if (count > 0) {  // Only show colors that were used
            const percentage = ((count / dist.total) * 100).toFixed(2);
            output += `\n${color}: ${count} (${percentage}%)`;
        }
    }
    
    output += "\n\nColors by Rarity:";
    for (const [rarity, colors] of Object.entries(dist.colorsByRarity)) {
        const rarityTotal = Object.values(colors).reduce((a, b) => a + b, 0);
        if (rarityTotal > 0) {  // Only show rarities that have NFTs
            output += `\n${rarity}:`;
            for (const [color, count] of Object.entries(colors)) {
                if (count > 0) {  // Only show colors that were used
                    const percentage = ((count / rarityTotal) * 100).toFixed(2);
                    output += `\n  ${color}: ${count} (${percentage}%)`;
                }
            }
        }
    }
    
    return output;
}
