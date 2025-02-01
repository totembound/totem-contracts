// utils/timeHelpers.js
const { time } = require("@nomicfoundation/hardhat-network-helpers");

async function safeIncreaseTo(targetTimestamp) {
    const latestBlock = await time.latest();
    
    // If target is in the past or equal to latest block
    if (targetTimestamp <= latestBlock) {
        // Increase by a small buffer
        await time.increaseTo(latestBlock + 2);
    }
    
    // Set to target timestamp
    await time.increaseTo(targetTimestamp);
}

module.exports = {
    safeIncreaseTo
};
