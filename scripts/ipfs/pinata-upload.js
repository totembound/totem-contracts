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
const axios = require('axios');
const FormData = require('form-data');

// Command line args
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error("Usage: node pinata-uploader.js <species> [output-file]");
  console.error("Example: node pinata-uploader.js falcon falcon-cids.json");
  process.exit(1);
}

// Configuration
const speciesInput = args[0];
const speciesLower = speciesInput.toLowerCase();
const speciesName = speciesLower.charAt(0).toUpperCase() + speciesLower.slice(1);
const outputFile = args.length > 1 ? args[1] : `${speciesLower}-cids.json`;

// Helper function to get rarity for a color
function getRarityForColor(color) {
    return COLOR_TO_RARITY[color] ? COLOR_TO_RARITY[color].toLowerCase() : 'unknown';
}

// Pinata API configuration - replace with your actual API keys
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
  console.error("Error: Pinata API keys not found in environment variables");
  console.error("Please set PINATA_API_KEY and PINATA_SECRET_KEY environment variables");
  console.error("Example: export PINATA_API_KEY=your_api_key");
  console.error("         export PINATA_SECRET_KEY=your_secret_key");
  process.exit(1);
}

// Pinata API endpoint
const PINATA_ENDPOINT = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

// Rate limiting configuration
const RATE_LIMIT = {
  batchSize: 3,              // Number of files to upload in a batch
  delayBetweenUploads: 500,  // Delay between individual uploads in ms
  delayBetweenBatches: 2000, // Delay between batches in ms
  maxRetries: 3,             // Maximum number of retries
  retryDelay: 5000           // Delay before retrying in ms
};

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to extract color and stage from filename
function extractFileInfo(filename) {
  // Expects format: color-species-stage.json
  console.log(filename);
  
  const parts = filename.split('-');
  const colorFile = parts[0]; // File color name
  const stage = parseInt(parts[parts.length - 1].split('.')[0]); // Extract stage number
  // Get contract color name from file color name
  const colorContract = FILE_TO_COLOR_MAPPING[colorFile] || colorFile;

  return { colorFile, colorContract, stage };
}

// Function to upload a file to Pinata with retries
async function uploadToPinata(filePath, name, retryCount = 0) {
  try {
    const data = new FormData();
    data.append('file', fs.createReadStream(filePath));
    
    // Metadata for Pinata
    const metadata = JSON.stringify({
      name,
      keyvalues: {
        species: speciesName,
        fileType: 'metadata'
      }
    });
    data.append('pinataMetadata', metadata);
    
    // Options for Pinata
    const options = JSON.stringify({
      cidVersion: 1
    });
    data.append('pinataOptions', options);

    // Upload to Pinata
    const response = await axios.post(PINATA_ENDPOINT, data, {
      maxBodyLength: 'Infinity', // Required for large files
      headers: {
        'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY
      }
    });

    return response.data.IpfsHash;
  }
  catch (error) {
    // Check if we should retry
    if (retryCount < RATE_LIMIT.maxRetries) {
      console.warn(`Upload failed for ${name}, retrying in ${RATE_LIMIT.retryDelay/1000} seconds... (Attempt ${retryCount + 1}/${RATE_LIMIT.maxRetries})`);
      console.warn(`Error: ${error.message}`);
      
      // Wait before retrying
      await sleep(RATE_LIMIT.retryDelay);
      return uploadToPinata(filePath, name, retryCount + 1);
    }
    
    // Max retries exceeded
    console.error(`Failed to upload ${name} after ${RATE_LIMIT.maxRetries} attempts`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Details: ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

// Function to save progress to a backup file
function saveBackup(data, backupFile) {
  try {
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
    console.log(`Progress saved to ${backupFile}`);
  }
  catch (error) {
    console.error(`Failed to save backup: ${error.message}`);
  }
}

// Main function to process and upload files
async function processFiles() {
  try {
    const speciesPath = path.join(process.cwd(), speciesLower);
    let result = [];
    
    // Backup file path for saving progress
    const backupFile = `${outputFile}.backup`;
    
    // Check if we have an existing output file to continue from
    if (fs.existsSync(outputFile)) {
        try {
            const existingData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
            console.log(`Loading existing CIDs file: ${outputFile}`);
            
            // Extract existing results from the file
            result = [];
            
            // Rebuild the result array from cidsByColor
            const cidsByColor = existingData.cidsByColor || {};
            Object.keys(cidsByColor).forEach(color => {
                const cidsForColor = cidsByColor[color];
                cidsForColor.forEach((cid, stage) => {
                if (cid) {  // Skip any undefined entries
                    const filename = `${COLOR_MAPPING[color] || color.toLowerCase()}-${speciesLower}-${stage}.json`;
                    result.push({
                    cid,
                    file: filename,
                    species: speciesName,
                    color,
                    stage,
                    rarity: getRarityForColor(color)
                    });
                }
                });
            });
            
            console.log(`Loaded ${result.length} existing CIDs`);
        }
        catch (error) {
            console.error(`Error loading existing CIDs file: ${error.message}`);
            console.log('Starting with a fresh upload');
        }
    }
    // If no existing output file, check for backup
    else if (fs.existsSync(backupFile)) {
        try {
            const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
            result = backup;
            console.log(`Loaded backup with ${result.length} already processed files`);
        } 
        catch (error) {
            console.error(`Error loading backup file: ${error.message}`);
        }
    }
    
    // Collect files already uploaded
    const uploadedFiles = new Set(result.map(item => item.file));
    
    // Get all rarity folders
    const rarityFolders = fs.readdirSync(speciesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    console.log(`Found ${rarityFolders.length} rarity folders for ${speciesName}`);
    
    // Process each rarity folder
    for (const rarityFolder of rarityFolders) {
      const rarityPath = path.join(speciesPath, rarityFolder);
      const files = fs.readdirSync(rarityPath)
        .filter(file => file.endsWith('.json'))
        .filter(file => !uploadedFiles.has(file)); // Skip already uploaded files
      
      console.log(`Processing ${files.length} files in ${rarityFolder} folder`);
      
      if (files.length === 0) {
        console.log(`All files in ${rarityFolder} already processed`);
        continue;
      }
      
      // Process files in batches
      for (let i = 0; i < files.length; i += RATE_LIMIT.batchSize) {
        const batch = files.slice(i, i + RATE_LIMIT.batchSize);
        console.log(`Processing batch ${Math.floor(i / RATE_LIMIT.batchSize) + 1}/${Math.ceil(files.length / RATE_LIMIT.batchSize)}`);
        
        // Process each file in the batch sequentially to avoid overwhelming the API
        for (const file of batch) {
          const filePath = path.join(rarityPath, file);
          const { colorFile, stage } = extractFileInfo(file);
          
          console.log(`Uploading: ${file} (Color: ${colorFile}, Stage: ${stage})`);
          
          try {
            // Upload to Pinata
            const cid = await uploadToPinata(filePath, `${colorFile}-${speciesLower}-${stage}.json`);
            
            console.log(`Uploaded: ${file} -> CID: ${cid}`);
            
            // Store the result
            result.push({
              cid,
              file,
              species: speciesName,
              color: colorFile,
              stage,
              rarity: rarityFolder
            });
            
            // Save progress after each file
            saveBackup(result, backupFile);
            
            // Delay between uploads to avoid rate limiting
            if (batch.length > 1) {
              await sleep(RATE_LIMIT.delayBetweenUploads);
            }
          }
          catch (error) {
            console.error(`Error uploading ${file}: ${error.message}`);
            // Continue with next file despite error
          }
        }
        
        // Delay between batches
        if (i + RATE_LIMIT.batchSize < files.length) {
          console.log(`Waiting ${RATE_LIMIT.delayBetweenBatches/1000} seconds before next batch...`);
          await sleep(RATE_LIMIT.delayBetweenBatches);
        }
      }
    }
    
    // Sort by color and stage for readability
    result.sort((a, b) => {
      if (a.color !== b.color) return a.color.localeCompare(b.color);
      return a.stage - b.stage;
    });
    
    // Format the results for contract use
    const contractCids = {};
    const cidArray = [];
    
    result.forEach(item => {
      // Add to the object for easy lookup
      if (!contractCids[item.color]) {
        contractCids[item.color] = [];
      }
      contractCids[item.color][item.stage] = item.cid;
      
      // Add to the array for sequential access
      cidArray.push(item.cid);
    });
    
    // Create output object
    const output = {
      species: speciesName,
      date: new Date().toISOString(),
      cidsByColor: contractCids,
      cids: cidArray
    };
    
    // Write to file
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\nUpload complete! CIDs saved to ${outputFile}`);
    console.log(`Total files uploaded: ${result.length}`);
    
    // Delete backup file
    try {
      if (fs.existsSync(backupFile)) {
        fs.unlinkSync(backupFile);
        console.log(`Backup file removed`);
      }
    }
    catch (error) {
      console.error(`Error removing backup file: ${error.message}`);
    }
    
  }
  catch (error) {
    console.error(`Error processing files: ${error.message}`);
    console.error(error.stack);
  }
}

// Run the process
console.log(`Starting upload for ${speciesName}...`);
processFiles();
