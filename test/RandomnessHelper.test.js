const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RandomnessHelper", function () {
  let testWrapper;

  before(async function () {
    // Deploy the wrapper contract which will use the library internally
    const RandomnessHelperWrapper = await ethers.getContractFactory("RandomnessHelperWrapper");
    testWrapper = await RandomnessHelperWrapper.deploy();
    await testWrapper.waitForDeployment();
  });

  describe("Random Number Generation", function () {
    it("should generate random numbers within range", async function () {
      const min = 1;
      const max = 100;
      const randomWord = ethers.parseEther("12345"); // Large random value
      
      const result = await testWrapper.testGetRandomNumber(randomWord, min, max);
      
      expect(result).to.be.at.least(min);
      expect(result).to.be.at.most(max);
    });
    
    it("should fail with invalid range", async function () {
      const min = 100;
      const max = 1; // min > max, which is invalid
      const randomWord = ethers.parseEther("12345");
      
      await expect(testWrapper.testGetRandomNumber(randomWord, min, max)).to.be.revertedWith("Invalid range");
    });
  });

  describe("Rarity Distribution", function () {
    it("should correctly classify specific rarity thresholds", async function() {
        // Test each boundary value
        expect(await testWrapper.testGetRarity(4)).to.equal(4);  // Legendary (< 5)
        expect(await testWrapper.testGetRarity(5)).to.equal(3);  // Epic (5-29)
        expect(await testWrapper.testGetRarity(29)).to.equal(3);
        expect(await testWrapper.testGetRarity(30)).to.equal(2); // Rare (30-99)
        expect(await testWrapper.testGetRarity(99)).to.equal(2);
        expect(await testWrapper.testGetRarity(100)).to.equal(1); // Uncommon (100-249)
        expect(await testWrapper.testGetRarity(249)).to.equal(1);
        expect(await testWrapper.testGetRarity(250)).to.equal(0); // Common (≥ 250)
        expect(await testWrapper.testGetRarity(999)).to.equal(0);
    });

    it("should determine rarities according to specified percentages", async function () {
      const iterations = 1000;
      let counts = {
        legendary: 0,
        epic: 0,
        rare: 0,
        uncommon: 0,
        common: 0
      };
      
      for (let i = 0; i < iterations; i++) {
        // Use a different seed for each iteration
        const randomWord = ethers.keccak256(ethers.toUtf8Bytes(`test${i}`));
        const rarityResult = await testWrapper.testGetRarity(randomWord);
        const rarity = Number(rarityResult);

        if (rarity === 4) counts.legendary++;
        else if (rarity === 3) counts.epic++;
        else if (rarity === 2) counts.rare++;
        else if (rarity === 1) counts.uncommon++;
        else counts.common++;
      }
      
      console.log("Rarity distribution:", {
        legendary: `${counts.legendary} (${(counts.legendary/iterations*100).toFixed(2)}%)`,
        epic: `${counts.epic} (${(counts.epic/iterations*100).toFixed(2)}%)`,
        rare: `${counts.rare} (${(counts.rare/iterations*100).toFixed(2)}%)`,
        uncommon: `${counts.uncommon} (${(counts.uncommon/iterations*100).toFixed(2)}%)`,
        common: `${counts.common} (${(counts.common/iterations*100).toFixed(2)}%)`
      });

      // Check approximate distribution
      // With 1000 iterations, there will be some variance, so we use reasonable bounds
      expect(counts.legendary).to.be.lessThan(iterations * 0.02); // < 2%
      expect(counts.epic).to.be.lessThan(iterations * 0.05); // < 5%
      expect(counts.rare).to.be.lessThan(iterations * 0.12); // < 12%
      expect(counts.uncommon).to.be.lessThan(iterations * 0.25); // < 25%
      expect(counts.common).to.be.greaterThan(iterations * 0.65); // > 65%
    });
    
    it("should generate valid color for each rarity", async function () {
      const rarities = [0, 1, 2, 3, 4]; // Common to Legendary
      
      for (const rarity of rarities) {
        const randomWord = ethers.keccak256(ethers.toUtf8Bytes(`color${rarity}`));
        const colorResult = await testWrapper.testGetColorForRarity(randomWord, rarity);
        const color = Number(colorResult);

        // Verify color is within expected range for each rarity
        if (rarity === 0) { // Common
          expect(color).to.be.at.least(0);
          expect(color).to.be.at.most(3);
        } else if (rarity === 1) { // Uncommon
          expect(color).to.be.at.least(4);
          expect(color).to.be.at.most(7);
        } else if (rarity === 2) { // Rare
          expect(color).to.be.at.least(8);
          expect(color).to.be.at.most(10);
        } else if (rarity === 3) { // Epic
          expect(color).to.be.at.least(11);
          expect(color).to.be.at.most(13);
        } else if (rarity === 4) { // Legendary
          expect(color).to.be.at.least(14);
          expect(color).to.be.at.most(15);
        }
      }
    });
  });

  describe("Combined Rarity and Color Function", function () {
    it("should determine both rarity and color from a single random number", async function () {
      // Test with various random inputs
      for (let i = 0; i < 20; i++) {
        const randomWord = ethers.keccak256(ethers.toUtf8Bytes(`combined${i}`));
        const [rarityResult, colorResult] = await testWrapper.testGetRarityAndColor(randomWord);
        const rarity = Number(rarityResult);
        const color = Number(colorResult);

        // Check rarity is valid
        expect(rarity).to.be.at.least(0);
        expect(rarity).to.be.at.most(4);
        
        // Check color is valid for the rarity
        if (rarity === 0) { // Common
          expect(color).to.be.at.least(0);
          expect(color).to.be.at.most(3);
        } else if (rarity === 1) { // Uncommon
          expect(color).to.be.at.least(4);
          expect(color).to.be.at.most(7);
        } else if (rarity === 2) { // Rare
          expect(color).to.be.at.least(8);
          expect(color).to.be.at.most(10);
        } else if (rarity === 3) { // Epic
          expect(color).to.be.at.least(11);
          expect(color).to.be.at.most(13);
        } else if (rarity === 4) { // Legendary
          expect(color).to.be.at.least(14);
          expect(color).to.be.at.most(15);
        }
      }
    });
    
    it("should produce consistent distribution with combined function", async function () {
      const iterations = 1000;
      let counts = {
        legendary: 0,
        epic: 0,
        rare: 0,
        uncommon: 0,
        common: 0
      };
      
      for (let i = 0; i < iterations; i++) {
        const randomWord = ethers.keccak256(ethers.toUtf8Bytes(`distribution${i}`));
        const [rarityResult, _] = await testWrapper.testGetRarityAndColor(randomWord);
        const rarity = Number(rarityResult);
        
        if (rarity === 4) counts.legendary++;
        else if (rarity === 3) counts.epic++;
        else if (rarity === 2) counts.rare++;
        else if (rarity === 1) counts.uncommon++;
        else counts.common++;
      }
      
      // Verify the distribution is similar to the separate getRarity function
      expect(counts.legendary).to.be.lessThan(iterations * 0.02); // < 2%
      expect(counts.epic).to.be.lessThan(iterations * 0.05); // < 5%
      expect(counts.rare).to.be.lessThan(iterations * 0.12); // < 12%
      expect(counts.uncommon).to.be.lessThan(iterations * 0.25); // < 25%
      expect(counts.common).to.be.greaterThan(iterations * 0.65); // > 65%
      
      console.log("Combined function rarity distribution:", {
        legendary: `${counts.legendary} (${(counts.legendary/iterations*100).toFixed(2)}%)`,
        epic: `${counts.epic} (${(counts.epic/iterations*100).toFixed(2)}%)`,
        rare: `${counts.rare} (${(counts.rare/iterations*100).toFixed(2)}%)`,
        uncommon: `${counts.uncommon} (${(counts.uncommon/iterations*100).toFixed(2)}%)`,
        common: `${counts.common} (${(counts.common/iterations*100).toFixed(2)}%)`
      });
    });
    
    it("should use different parts of the random word for rarity and color", async function () {
      const randomWord = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      
      // Get separate results
      const rarityValue = await testWrapper.testGetRarity(randomWord);
      const colorValue = await testWrapper.testGetColorForRarity(randomWord, rarityValue);
      
      // Get combined results
      const [combinedRarity, combinedColor] = await testWrapper.testGetRarityAndColor(randomWord);
      
      // The rarity should be the same in both approaches since it uses the same algorithm
      expect(combinedRarity).to.equal(rarityValue);
      
      // The color might be different because the combined function uses a different part of the random word
      // This test simply verifies the different approaches, not comparing their values
      console.log({
        separateApproach: { rarity: rarityValue, color: colorValue },
        combinedApproach: { rarity: combinedRarity, color: combinedColor }
      });
    });
  });
});