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
         14, 15]       // Legendary -> EtherealSilver, RadiantGold
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
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        11, 11, 11, 11, 11,
        2, 2, 2, 2, 2,
        2, 2, 2, 2, 2,
        2, 2, 2, 2, 2,
        2, 2, 2, 2, 2,
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
        7, 7, 7, 7, 7,
        8, 8, 8, 8, 8,
        9, 9, 9, 9, 9,
        10, 10, 10, 10, 10,
        11, 11, 11, 11, 11,
        12, 12, 12, 12, 12,
        13, 13, 13, 13, 13,
        14, 14, 14, 14, 14,
        15, 15, 15, 15, 15,
        0, 0, 0, 0, 0,
        1, 1, 1, 1, 1,
        2, 2, 2, 2, 2,
        3, 3, 3, 3, 3,
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
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
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
        "bafkreigpmhef7yjgtdtferp6lo53yihkqeg5bn5bpmf5tst5dkngxvysda",
        "bafkreihuyeh4vinb7esnnupoyqzadfjzsrjydxmpstkunmehc7pno6rqsm",
        "bafkreif34xtgrqvzdn6wzedrljzvvnxyyg4vorhqym5czklnrzfn4xshrm",
        "bafkreiewocpfbqo5e6ono4newyhpr4tdfkfq4zg5s2dtuuixuxkhmuan6y",
        "bafkreigfzghematxmv2hhlfsvo2i3pinb2pz3h7tys36v6moveommvxdw4",
        // Owl - Gray
        "bafkreias7d7dxnobao44rmnctt5slucxos5spbrxdy3nucjdo7nv6pumfe",
        "bafkreih4ympxnhitddvvcg3epmrwyxtclwqiigwpbuhsfgvy6phoob2vs4",
        "bafkreie4rcocubidyd4ftc25nelk4fcahaacg4vrs5dfc6735urs47ovuu",
        "bafkreifxdkegupx67uw7cdxifuvq6t7f2owndaivzwvsatneipw3fpgb3a",
        "bafkreihgycdbzpbd72vdhviaqrpufq5bzrini2zpfhytcr7qj5bpngzg5u",
        // Owl - White
        "bafkreihmmuk4uaitzvkmubzh4dxsrisib6eml4vsjt2ybhsirgrrgfb774",
        "bafkreifbbtocjcvt4hd2cbvyzggoaijgegetbk5ouir2q3n446pqokrwii",
        "bafkreibhj3s7uwnrrsaielrvztt36e3uctfmchegnveugphwm7kpsm55s4",
        "bafkreia4vyx6otsopb2xd5ktr6h4d2ad6cas35ihtshxfuqyas5x6d4zhm",
        "bafkreic2l5q3wagng7eo7hlesxepwi53ksjuebrkwrq3bztz6odpoiy7ou",
        // Owl - Tawny
        "bafkreieellpqpsu44uyu2xcwsyokvdlhhgr4sbn62s36qjrop6vz2ihp2a",
        "bafkreigjb42c52c4gxa3x4yvmdpou4vkclh7njmg77kordi7f6lkn2rz2m",
        "bafkreic6ujegv75f7kl4nzk4omm6ngyurobuwdfhv4vf7bpvd26hoqq3sa",
        "bafkreihtsxt4sov6fkj4apmtql67sa6jkaweeag6e76jpi7eejendi5rzm",
        "bafkreicg4th7sphch5lx3v4nsdpbqta3fnwklcpi3viywwooj4646gjcui",
        // Uncommon
        // Owl - Slate
        "bafkreiee4bji6bx5mbahpzsbvepben4hj6ltd5olwslwojp7t2dxc3t2z4",
        "bafkreib6c4jux7yjbguwyi5kljkic4eaitvayk5l3hgzuadii7zhx5q63q",
        "bafkreiegjq2zvtjbjiffkeaqjpq62aduxrwwr7h2pcm2oytgwikh73dhoy",
        "bafkreiat3x2tpys4p5bn3zrcg7znyodcxoeuczxcw472ky44gfs2cqzfqm",
        "bafkreiam6mygpsea3wutmwxzkyxbqkvb6gdotnnynizvhluf5qhndwlqsy",
        // Owl - Copper
        "bafkreid6mn5z3zpoykjibihulovnc5r5tzqxbenpnl3pzd5zeyi5dnv7ha",
        "bafkreihx3uphkjrv6snoquy4wiwl323ojxsu647xzzgdb6gqbs67f4ggk4",
        "bafkreicxuip5yarr7rypysmse3mrghkljm2qxetjv2xsl3k7phljbstknm",
        "bafkreihz6tcfmj4i5i2ozs5v4wus24ulqamf624yahk5zkkkvunryrtysq",
        "bafkreiepinmmcwtlwbv3bz3lwnbdulqqg434p5i6f4j2xmi2lidezptmai",
        // Owl - Cream
        "bafkreihqwkjlm36vtgn2jqfzh2lxxs6bote5trjxoyixoz3pvkioipilny",
        "bafkreieabfpvjrls2bkc6zw3semntpr5gcffa4wuouc5crcf3qdl6rjtu4",
        "bafkreialtc3rxstnivzpy6zv3zihjw2loazrleg3hrnr7deqplpwf22tha",
        "bafkreifseimu6wt5xqqd64fuycozjkcwwby6233rmmg2rmpefkci47z3vu",
        "bafkreihrnya3dsd2t4apycflergwr5afeh5oxyrigpag36jglldxqcbv3e",
        // Owl - Dappled
        "bafkreihy7vppw5s3encvif2ifqf2khhv2ndvqceqw6yacun4zxjynbs7ri",
        "bafkreiesceq5yidn7upazp5v7krfqxubsvvpqfnfpsnbj3noq42jtitlny",
        "bafkreiai7wadskhq6wmmuqct5gmtm4svjdwlynhyhl7k3p5bjkhneck2py",
        "bafkreibrfuubvlwfqjxq46wbdojzedkaitxhokjgilqnnpldgozp5kj2ni",
        "bafkreiaqqhuuuqz4ecg6ecxngyj3u4s2xkyrof2cs46g6tbj2uvja2vkbu",
        // Rare
        // Owl - Golden
        "bafkreihuify6lpt52cy5ip7mqkuuu4htniqnnd2z7t4t7dy7nj3kx6f6ne",
        "bafkreiaumw5fwmec2wuriiwaksnhjkpnfqsy2uoy5enrr2d5pdnzxd7t7y",
        "bafkreibxlbryv56wdcfmpn6pvaoihakkor23eymfk3sd2pkleaifqxqofu",
        "bafkreib57xydwqhehzbonkk2l3tvdk354u6blaurr5eudipb4crnleosoq",
        "bafkreibzmzql22quh3tt75y33vbymbir5xxjlf33pv4ze7qu3daqjv2m3q",
        // Owl - Dark Purple
        "bafkreieahgflcyrx7oc6cttfylmu7jk4ivba3ma4efxtxstls7web5oxra",
        "bafkreihyh2qvkncn6vkmsob5awkgjv5uukloco5574dvlcosb2h4x4kkqy",
        "bafkreig7bdrw75slkmd2bskcuo5cc5xw2j7igw2giuszul7czqga2i2fsu",
        "bafkreihxzfxpfvnagptqfj6ndjs6iuf4zcq3xuuferkk6d7ewmlxs3lujq",
        "bafkreicceczs77ld3rz6ia2yaye5seidzpeuefimnjrqwvioy5rc7f7ryy",
        // Owl - Charcoal
        "bafkreifu5s7yfmrcer5r2w2casa2evmqzywofsditgs3bhvbvk3prdunfy",
        "bafkreif5muzaan7opnujterqdgeyxds2ceajjgoerxmokc3ots4jbf3nvu",
        "bafkreifhyvnp4jczrthcbmk2y53vzrgz5cclmecdz2sdwqykmfjihvzvrq",
        "bafkreibcuas64sc3djlfunexmnunvt4ipwjaeuohxkukos2jui6zc7qjwa",
        "bafkreif4sqptycrymvfp7bcsyd6eepn36aztouni2hkx2kam4ckliiat4u",
        // Epic
        // Owl - EmeraldGreen
        "bafkreieiv73j6m5ztw3j6xwownrpm5nrlzmlv2ypze7bfuzayh6553evkm",
        "bafkreiaedk5avidkguv4yc5jf4eevvny2ulentlrelbwj2pmln45yikbby",
        "bafkreidak7oa5saa62a2ewnblik4dwtmeryy5evj2csvuzqy2hgfqc23q4",
        "bafkreidbu46pqtvsapqy22wawaiurexegvo3czy7mq2ucexqi3odghqlla",
        "bafkreigffgxamzlbmexr7m7uu6yxdur3nfblqhlfjtlbicnavkfh3f6dgm",
        // Owl - CrimsonRed
        "bafkreib7kzwajonegvvqryxn3ment5e4k3cvf7hvmzobbw5ho7afrxw42e",
        "bafkreia5jx7m4qstk4yozuzm4rygfp26wpwrxmf2cxo55odouprj34xngm",
        "bafkreidmnkfkbk23muajibjalusfyf2vgjvaolsfgtxfnsbqhui662bh4i",
        "bafkreifcnigbntri3zwib5vkhymhofzhjojrlbdq2xuewdq4qqob2e6mza",
        "bafkreigikcd25tqclrdjra2trmmijumkqenjb54eaor23sjjilbfmclaf4",
        // Owl - DeepSapphire
        "bafkreicpjsfhhusg26cu753r6cb7576nmy4hh7bzuoxnhrpruvlv5wo6zq",
        "bafkreia2bkjafg2r7ftka6comqwb6ju2fqtxnajcply3utaogmnnqwlvne",
        "bafkreigcazdmi5wsxqvhdb3fhpx5ntb4d7i4bnrjspny7hntoxsgy35avu",
        "bafkreia4wfo5eohn2ztqeduuxgvkak6qubnkycfmesftxrklce7olro66q",
        "bafkreihsm2mhdz3dojcnfjwsvvg7g4q3nr7mbpj3rqsn4yo7miogj6ut6u",
        // Legendary
        // Owl - EtherealSilver
        "bafkreifc7maocfbmsjn23nklxhugixsuspib4kxpg2vsfo6l2j7jh26jnu",
        "bafkreidkphe4xobaplcx543xefn4avnnvxqxnv4fz7f2qiokbpnia7otyy",
        "bafkreif3xns3eywgp2s3v2usuluh5b3ak3mjrfmzrrg3ruqqfx5kfo5ibq",
        "bafkreiha7vyjsu7jesezusi6zhvzas3d23772fr4kujauud2nlqjtbfrwq",
        "bafkreic653dfn6wr54fdkqyeirfb5ysighmmiw2fjzq66rcuhbhsmnphla",
        // Owl - RadiantGold
        "bafkreihq4p6dckkm3ksbmfkgwy5boaoycgt2iqdgpdkqqlucc27xetraqe",
        "bafkreialt3kdpobb54b4mhn4wtgil3ct4djt7nu3xi3fc4erirnbbyk2bi",
        "bafkreida3sea3n3kbthngns5kqsrohkb47oip5qe4kiian7g2qwnobap7e",
        "bafkreih5sadipld2dbnjg7xyshrxos3ngplixn4mpa43pcttrdzfd5xhlq",
        "bafkreia5cxhlwdc4pu6lhsduy7hw7xyo5zaqebucpkngnkafmh6nxaed2m",
        // Common
        // Wolf - Brown
        "bafkreifxb67n72jum6ovkpuggjsrfe42iit3r3rjrnhywqw4shjokgkkb4",
        "bafkreifxouonku3tz765pcrqqlky6xc73fddavgxbgrw4m6iq37bneiqtm",
        "bafkreig4usgvyl7vfueqc7i3bnhu2jdjls5drvpffpdducvduhxwthzpdi",
        "bafkreid7ennkh2e245emnzpwqesz5qsqh3atqxiprpt7swlmkrc4srqolq",
        "bafkreib5cfyhxofroigo6d4mwk4awsxzfm2rs72gz7hsf6q37khdqartv4",
        // Wolf - Gray
        "bafkreidxshykw2ze6xnbgg7kddchy2ywyqlgbebhhovmxmixe326zxcqmu",
        "bafkreidxm4wax5edcrq4ko7c3zaboifqvp7lmljhoskdsxujuskzfqpvyq",
        "bafkreic7ij5oqz7bqptgx5erpnc2o5pzjsfhl2jrpwlpql6dumt5p5bofm",
        "bafkreiedxud3nzrqeho4phh5wn3uwivektvh6velgu55f52uxzquuvsqm4",
        "bafkreic7ph4o6x5gwn7nxzomaourmcgkcbhyjtiutze5itvzb3xqy6nvbe",
        // Wolf - White
        "bafkreicetpnjd4nlb34yfyp74jrm6ujedg6466jztng3qhufk3aeo3z2ye",
        "bafkreiem7f6gtnhtqmmv7e5w62bhn7wdpbpg5xw5q6rirorjlqn53ysmxe",
        "bafkreifrrqjzvqshnthzr4hal6mieoqzbp7o5oo3tsrrcpuroz4xqulsz4",
        "bafkreiehzqdmciw45p7sur5js24smod6karfr2nyake54jswec4azh3gle",
        "bafkreigyxcauzzltmoifbaz7m4st2qr5piwtxhmlkhrqokjo7pb76gcqsu",
        // Wolf - Tawny
        "bafkreigdx32bf7givtmngpmuxwz7pxl6dv4xwsybmm6aosbo65azb553ma",
        "bafkreialz4dzzvngecb53h7m5gxle7jgqg3j7cjvitp7h7uxwlgff6zmrm",
        "bafkreict7uuc263lc4bk45bo3uvit5l55uvi76552hrpjeotw6yifa5o7u",
        "bafkreigum6t5rlqioqflp74tfwfkpuh77pbm77chz5ibucmnjviumlm64a",
        "bafkreibxaicvcqw5horu553n5bxomkdazbabquthhndowc6vpsrk6r6sr4"
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