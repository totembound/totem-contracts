#!/usr/bin/env node
const { 
    DEFAULT_IMAGE_PLACEHOLDER, 
    COLOR_MAPPING, 
    RARITY_BONUSES, 
    COLOR_TO_RARITY, 
    FILE_TO_COLOR_MAPPING 
} = require('./common');

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Error: Please provide a species name");
  console.error("Usage: node generate.js <species> [config-file]");
  process.exit(1);
}

const speciesNameLower = args[0].toLowerCase();
const speciesName = speciesNameLower.charAt(0).toUpperCase() + speciesNameLower.slice(1);
const configFile = args.length > 1 ? args[1] : `${speciesNameLower}/${speciesNameLower}-config.json`;

console.log(`Generating metadata for ${speciesName} using config file: ${configFile}`);

// Load species-specific configuration
let speciesConfig;
try {
  speciesConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  console.log(`Loaded configuration for ${speciesName}`);
}
catch (err) {
  console.error(`Error: ${err.message}`);
  console.error(`Could not load configuration file: ${configFile}`);
  process.exit(1);
}

// Function to ensure directory exists
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// Format JSON output with custom styling
function formatJsonOutput(metadata) {
  // Create a formatted version where we have control over each part
  let output = `{
  "name": "${metadata.name}",
  "description": "${metadata.description}",
  "image": "${metadata.image}",
  "attributes": [
    { "trait_type": "Species", "value": "${metadata.attributes[0].value}" },
    { "trait_type": "Affinity", "value": "${metadata.attributes[1].value}" },
    { "trait_type": "Domain", "value": "${metadata.attributes[2].value}" },
    { "trait_type": "Color", "value": "${metadata.attributes[3].value}" },
    { "trait_type": "Rarity", "value": "${metadata.attributes[4].value}" },
    { "trait_type": "Strength", "value": ${metadata.attributes[5].value} },
    { "trait_type": "Agility", "value": ${metadata.attributes[6].value} },
    { "trait_type": "Wisdom", "value": ${metadata.attributes[7].value} },
    { "trait_type": "Stage", "value": ${metadata.attributes[8].value} }
  ]
}`;
  
  return output;
}

// Main function to generate all metadata
function generateAllMetadata() {
  const basePath = path.join(process.cwd(), speciesNameLower);
  ensureDirectoryExists(basePath);

  const { 
    baseStats, 
    affinity, 
    domain, 
    colors,
    imagePlaceholder = DEFAULT_IMAGE_PLACEHOLDER 
  } = speciesConfig;

  // Process each color
  Object.keys(colors).forEach(colorName => {
    const colorConfig = colors[colorName];
    const rarity = COLOR_TO_RARITY[colorName];
    
    if (!rarity) {
      console.error(`Error: Unknown rarity for color ${colorName}`);
      return;
    }
    
    const rarityDir = path.join(basePath, rarity.toLowerCase());
    ensureDirectoryExists(rarityDir);
    
    const fileColor = COLOR_MAPPING[colorName] || colorName.toLowerCase();
    
    // Generate metadata for each stage (0-4)
    for (let stage = 0; stage <= 4; stage++) {
      if (!colorConfig.stageNames[stage] || !colorConfig.stageDescriptions[stage]) {
        console.error(`Error: Missing stage name or description for ${colorName} stage ${stage}`);
        continue;
      }
      
      // Use specific image for this stage/color if available, otherwise use placeholder
      const imagePath = colorConfig.stageImages && colorConfig.stageImages[stage] 
        ? colorConfig.stageImages[stage]
        : imagePlaceholder;

      const metadata = generateMetadata(
        colorName, 
        rarity, 
        stage, 
        speciesName, 
        affinity, 
        domain, 
        baseStats,
        colorConfig.stageNames[stage],
        colorConfig.stageDescriptions[stage],
        imagePath
      );
      
      // Write metadata to file
      const fileName = `${fileColor}-${speciesNameLower}-${stage}.json`;
      const filePath = path.join(rarityDir, fileName);
      
      // Custom JSON formatter
      const jsonString = formatJsonOutput(metadata);
      fs.writeFileSync(filePath, jsonString);
      
      console.log(`Generated: ${filePath}`);
    }
  });
  
  console.log(`\nMetadata generation complete for ${speciesName}`);
}

// Generate metadata for a specific color, rarity, and stage
function generateMetadata(
  color, 
  rarity, 
  stage, 
  species, 
  affinity, 
  domain, 
  baseStats,
  stageName,
  stageDescription,
  imagePlaceholder
) {
  const rarityBonus = RARITY_BONUSES[rarity] || 0;
  
  // Calculate final stats with rarity bonus
  const strength = baseStats.strength + rarityBonus;
  const agility = baseStats.agility + rarityBonus;
  const wisdom = baseStats.wisdom + rarityBonus;
  
  const metadata = {
    name: stageName,
    description: stageDescription,
    image: imagePlaceholder,
    attributes: [
      { trait_type: "Species", value: species },
      { trait_type: "Affinity", value: affinity },
      { trait_type: "Domain", value: domain },
      { trait_type: "Color", value: color },
      { trait_type: "Rarity", value: rarity },
      { trait_type: "Strength", value: strength },
      { trait_type: "Agility", value: agility },
      { trait_type: "Wisdom", value: wisdom },
      { trait_type: "Stage", value: stage }
    ]
  };
  
  return metadata;
}

// Run the generator
generateAllMetadata();
