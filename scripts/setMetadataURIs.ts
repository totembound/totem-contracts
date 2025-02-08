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
        deployment.totemNFTProxy
    ) as unknown as TotemNFT;

    // setup the colors
    await game.setValidColorsForRarities(
        [0, 0, 0, 0,   // Common
         1, 1, 1, 1,   // Uncommon
         2, 2, 2,      // Rare
         3, 3, 3,      // Epic
         4, 4],        // Legendary
    
        [0, 1, 2, 3,   // Common -> Brown, Gray, White, Tawny
         4, 5, 6, 7,   // Uncommon -> Slate, Copper, Cream, Dappled
         8, 9, 10,     // Rare -> Golden, DarkPurple, Charcoal
         11, 12, 13,   // Epic -> EmeraldGreen, CrimsonRed, DeepSapphire
         14, 15]       // Legendary -> RadiantGold, EtherealSilver
    );

    // Define metadata URIs for the Common Owl
    // Species: "11" represents the Owl
    const species: number[] = [
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11
    ];
    // Color: Brown, Gray, White, Tawny
    const colors:  number[] = [
        0, 0, 0, 0, 0,
        1, 1, 1, 1, 1,
        2, 2, 2, 2, 2,
        3, 3, 3, 3, 3,
        4, 4, 4, 4, 4,
        5, 5, 5, 5, 5,
        6, 6, 6, 6, 6,
        7, 7, 7, 7, 7
    ];
    // Stages 0 to 4
    const stages:  number[] = [
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4
    ];
    const ipfsHashes: string[] = [
        // Common
        // Owl - Brown
        "bafkreidbvyniutzdrxcs633f2lg7bvhchxzaeznjcvzlntmjylphyrzwku",
        "bafkreifgv2itn6hmfxvybnczvizkl3q2ev7lfl34ucfl7vkawu5kojruvu",
        "bafkreicfw5ukosgsgtl7c7z7764ohahuo4r4uyrvtg5zxaiqfp7slvgk6m",
        "bafkreigbfq3bafyfnzg37jfjfxi2qsex7dfsiajvkwx7554eygjk7f2mje",
        "bafkreih7goltd46ityvqc33du2htn5le6kdru5e7xlmi2ua5h6bwxgb4gu",
        // Owl - Gray
        "bafkreigdgbmtlge6cykmrztm7enff6t3lx67hfd2vquytczy3taxw35fg4",
        "bafkreih77badc5su4j65grveesdwoxlronjpdgydtqdvniarzqozrfbm6q",
        "bafkreibmbv53r67cdgqkhf7byxpi7mwd7w33c7oug35flxtoy4rbaqkg64",
        "bafkreigudp67jqzryogpbdexogbqspcj6pqlaczrt7vi4ng45c2wkp47bi",
        "bafkreien3enrlbwbk4essz6rlfclaf4n53bx4u5pxr2toqurdaayxrr5ja",
        // Owl - White
        "bafkreigwxa3ssl75b7iptr5fv3h5g66iu2jbjhhztrrzoiunoucbr65pwe",
        "bafkreicbqkprldg4gm5yhzvxa3v5y5oeo6oegafqekbt2634ox5xssa22q",
        "bafkreidfvrr4jxogbtqa5mewqlfqddqpslqrxj7gnramq2hgqs26y4uldm",
        "bafkreieixnjlmoqhf7q2sgwpmibxfrchfs3slhrocbx5ec7mfkdx5543fi",
        "bafkreibfdbc4k7d7miruij3vihvvbhvyp252tybtw3suovfd5rptfqf2hy",
        // Owl - Tawny
        "bafkreicju5dpggeinc23wby4qp2dop2u624z3gx6sig75h2b4q2by6sb2y",
        "bafkreiakvhjkgurnefejsnlgkigv6le62b5qu577xowtnntonzb6wox3ea",
        "bafkreifqwavhs372oyfdlkcpyrx72hvfzablobbnwqtc4tj7gn4d3b6df4",
        "bafkreibmke5docnoyqgbufvqsoxmsh7t2ie2vwk6htxctzdxqjnehzbxqy",
        "bafkreihs6efjzafejwldigzj2c7dxl5mhmf2kgwsxjqctfafdbnnwkt27m",
        // Uncommon
        // Owl - Slate
        "bafkreif6akywp2ncav327yldfkbuvycdaa4kahuwwfns5ujef2dc3kwtaq",
        "bafkreihhugi4d6apfmyg3cphqbcwohjlnli53j6e5jqslqewrcpcbx2v3q",
        "bafkreifzvul24g65upzj7m7xlzlbtprbjn3i2a3mqvkeawhmhswnlupz64",
        "bafkreiarbyjojoiu43pusft5kjcuitcmpfgsrwxckjtlmculu4opjzcuyu",
        "bafkreigne7yhpva6ryatpjmw2sxig7puhxpaeiot2bhjwfkfv3eax4p4tm",
        // Owl - Copper
        "bafkreigsaoeu2ufrptfp5opruee6x5lymdl5ft5zalhnmbs4sgiokuztra",
        "bafkreicrhl457inc5mb2tilnxw27kefgmbi2kuqokd4gwaiyx26kh5lajq",
        "bafkreighu2qpbs5kozpzrmvchjtiaybwh5f5viwtfk6re4rxhxwbiz7jga",
        "bafkreibi6avstnbvdqssy2v2ltfkx3euv2xmirqalakeu32y3plx5fn7je",
        "bafkreiaojgo5ruhycj5x2tqc3yo4gnnxe6ldcisgkgcjwy657tjlnjkm6i",
        // Owl - Cream
        "bafkreidh23mgoikw2semtqywatal4gvicexrpwsj5bcccuu5tmszwowt5y",
        "bafkreiafrsntia2zldmjallotldpx7lj5qmqfcqopdaohro2a34s4pvkqm",
        "bafkreiaviw37cai6opska4wqyrdfizxf3tjcugljc7czn2mnpdazd53aky",
        "bafkreiarvipxw2475mvtbchb6x7ytlyjb322zswydpd7iuyjiexqf7ylge",
        "bafkreibjlwudw652djhn5ikilwj57puqfrqk5jib47ijxlknwmhzd7w2cy",
        // Owl - Dappled
        "bafkreiamp4of27u5e3ttc5s3czxv3ut6ybwjb4jc2izeaaua3af5mzzl4a",
        "bafkreiesvjqlgtmxz55vzxzpwoc2brvdckzbnmncxnv7iqqijfrb7n3qja",
        "bafkreigr23bf2hxwj4qqnxmspschgzyk76liggbiud22kpenhuqagbzkxu",
        "bafkreidfwsgt2ok4hcpmf7tiqmbpms6vcefonm2daksgz66y34wiqtpjo4",
        "bafkreiesiz2fyujxfgqhqaiitwmotx56cmlzjyj6nghz6rxtnnxixekzhi",


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