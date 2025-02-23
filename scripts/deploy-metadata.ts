import { ethers } from "hardhat";
import { loadDeployment } from "./helpers"; // Adjust the relative path based on your folder structure
import { TotemGame, TotemNFT } from "../typechain-types"; // Adjust based on your typechain output directory

// Function to get last day of current month at midnight UTC
function getLastDayOfMonth(): number {
    const now = new Date();
    // Get the first day of next month
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    // Subtract 1 second to get last moment of current month at UTC midnight
    return Math.floor(nextMonth.getTime() / 1000) - 1;
}

function getEndOfWeek(): number {
    const now = new Date();
    
    // Get next Sunday
    const daysUntilSunday = 7 - now.getUTCDay();
    // If today is Sunday and we've passed midnight, we want next Sunday
    const targetDay = daysUntilSunday === 0 && now.getUTCHours() > 0 ? 7 : daysUntilSunday;
    
    // Set to next Sunday at midnight UTC
    const endOfWeek = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + targetDay,
        0, 0, 0, 0
    ));
    
    // Convert to unix timestamp (seconds)
    return Math.floor(endOfWeek.getTime() / 1000) - 1;
}

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
         4, 4,         // Legendary
         5, 5, 5, 5,   // Limited, 12 colors
         5, 5, 5, 5,
         5, 5, 5, 5],
        [0, 1, 2, 3,     // Common -> Brown, Gray, White, Tawny
         4, 5, 6, 7,     // Uncommon -> Slate, Copper, Cream, Dappled
         8, 9, 10,       // Rare -> Golden, DarkPurple, Charcoal
         11, 12, 13,     // Epic -> EmeraldGreen, CrimsonRed, DeepSapphire
         14, 15,         // Legendary -> EtherealSilver, RadiantGold
         16, 17, 18, 19, // Limited -> FrostbiteBlue, RosyPink, VerdantGold, RaindropTeal,
         20, 21, 22, 23, // FloralViolet, SunsetOrange, EmberRed, OceanicAzure,
         24, 25, 26, 27] // HarvestGold, PhantomBlack, EmberwoodBrown, StarlitSilver
    );

    // Define metadata URIs for the Common Owl
    // Species: "11" represents the Owl
    const species: number[] = [
        1, 1, 1, 1, 1,
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
        2, 2, 2, 2, 2,
        2, 2, 2, 2, 2,
        2, 2, 2, 2, 2,
        2, 2, 2, 2, 2,
        2, 2, 2, 2, 2,
        2, 2, 2, 2, 2,
        2, 2, 2, 2, 2,
    ];
    // Color: Brown, Gray, White, Tawny
    const colors:  number[] = [
        17, 17, 17, 17, 17,
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
        4, 4, 4, 4, 4,
        5, 5, 5, 5, 5,
        6, 6, 6, 6, 6,
        7, 7, 7, 7, 7,
        8, 8, 8, 8, 8,
        9, 9, 9, 9, 9,
        10, 10, 10, 10, 10,
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
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
        0, 1, 2, 3, 4,
    ];
    const ipfsHashes: string[] = [
        // Limited
        // Otter - Rosy Pink
        "bafkreighval4flz7kk5xm33lfu66eyuptbewpfehb37fp5i3nhm5kmdwwu",
        "bafkreie5bfsnm7mshrmzejnoaevwz7yaeyffph7zmpuyqytb2g74wqiueu",
        "bafkreic2j2sjp5kzmgubx5x3y5k34lk7nrsjkj52vv5b42ppi4h5i7v5x4",
        "bafkreiawd2ic76wgw43aoer2rnkzswacpnmkbnlolo7d7e2fd4sqilcrle",
        "bafkreig6rpjmbrsa443jlsx7ogxih74h4ctnymt5zkrwjjoueijiydxwke",
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
        "bafkreibxaicvcqw5horu553n5bxomkdazbabquthhndowc6vpsrk6r6sr4",
        // Uncommon
        // Wolf - Slate
        "bafkreids3yvrhv32rqccwojouoey72rc7xi5erhug6q6xwvpswdvvyjewe",
        "bafkreihfyi2whykegh56jpnhpvetbskp3edtv7yehbrrrpn5ommsbvffgq",
        "bafkreiajhcqmmoduyujtll5oxqigzp73a6d24ph5r5uual3pk7tqg4lm4y",
        "bafkreihobbww6bln6ysp342dzvrv2capgregoaunamw4blfo2r3u3e3wza",
        "bafkreic32rzraeicrr7bagpgwelhz6oaxsppvauzggqjznphva6j6hc7qq",
        // Wolf - Copper
        "bafkreibikjtfau6hgfwovmggnpezvp56rtvysurwjrsfu3fphxym5jlz4y",
        "bafkreifa3gi4j2hhlwrxi3j7p3grbft6ldwi65hgn6if2vkruitpx66hgm",
        "bafkreictuiintcnxhk23pa32az663dzoqqf3quhqbhm7crwgisb5mss6nu",
        "bafkreibqhieduyusjvgdtn55bvt2ylio4wdfyjarw7rdsmce4z27i6fbc4",
        "bafkreibt5bk2wewedle3uzwichmnvajius6h36lccdvol3s5swewahbl2a",
        // Wolf - Cream
        "bafkreiezv476xrysdchvmzlhole7ywglq7sws6ggz5k24zuvpezv55jlti",
        "bafkreicwugvh27wsaqh32ihv4imabsebhlla3kmf25aqrpummoyss5orf4",
        "bafkreigqkazvr4gcalr3k6y4asx7p5llqcx75g2cgrdzauim52nzovowbq",
        "bafkreibstoqeblomjnid6zr4j5mqaawchms2ftxiqinjfzgro6aa76blam",
        "bafkreigvu2ajjoequcduqg2fj7kjqb3uig3oglfls4jmpqddtlkm7wnds4",
        // Wolf - Dappled
        "bafkreierkb7jc35xipovoeakbbyyrcvnsyvlmsn3uuwq3rv4f2swdb6x7a",
        "bafkreifk4kz3azzvp4aoyqxbqx7zarv74wtno7g2pcnl52x4zabcwm4k2e",
        "bafkreiep6rthifus7dln7tqwbreprn5u6q255oxsedyy2rjnmn53g4ebay",
        "bafkreic4w3mgxcjlxtxddv4xhsdo6lzyflo4c7olzfhtru7bm7uxl57wc4",
        "bafkreic7hpsijyaeygcixtha5zvb7fp4kcdhkb2idpvmryk5yn567jyqsu",
        // Rare
        // Wolf - Golden
        "bafkreiarl7fz7hmc5fwg6dln2avbwtzxbrf4y7hqjput72utjfsmupqxl4",
        "bafkreidihqfpczuwk3y4rvtclxmk2zmsqg3cxaioopd57uhg2tjcyvo4p4",
        "bafkreibex2zzl6xgx34goah3vsnxnnycoyr6douwirnowdlxmu3yzm4qve",
        "bafkreihhmyh4pih3h4as2xxec6ljiepx4gabub2oju54er7jg35sxbxf3u",
        "bafkreidbcpfohdsnimpdzxvywjsiemrammv22a7wsrcbcnnhooyup2nmiu",
        // Wolf - Dark Purple
        "bafkreiehpsvko55crvwmnd6dnanwrdw4b2u3bucinmvftn6gm44js3dvc4",
        "bafkreihbxrnqdvzu2htqwh273xrttmo6wp7hgrcehc65foolbp4m6wlmnq",
        "bafkreiggyf47o3dsxo3irpowdvkk5a75sgj2lbrtuwcopmdn5d7rp5fo4e",
        "bafkreicb4bdytrd4zjd3vla5vv5qnk7hcxoj4b4pjxmuz4s6ac2sxtly3e",
        "bafkreiadezjfapku3jvnusebc35b73hkuvz5t3fddkfoxlemqjnzza6qqe",
        // Wolf - Charcoal
        "bafkreicygk4jixeqlbz3smqyufz2ukijks4qmfwzboljko7i5s3iuhbstu",
        "bafkreia4n2sn7ukgw6kjbf6pxlw7iduymovhdsafj5lhedmwic4heczw4y",
        "bafkreig2hujbvbd2je7hfvbn3mofk4cqsgtazakqza7jksi4qqthsqdozm",
        "bafkreig7bq7n7nanedtrl5jj2etiiuhovt7k4bpbtunt2mao7tvx56j25i",
        "bafkreieb6rft73ib5nrqgppxawscjptmtuuvp4efbpnrwsgrxugihb5ndq",
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

    // Setup initial bundles
    console.log("\nSetting up initial bundles...");
    const monthEnd = getLastDayOfMonth();
    const endOfWeek = getEndOfWeek();

    // New Player Bundle (10 POL)
    console.log("Creating New Player Bundle...");
    await game.createBundle(
        ethers.parseEther("10"),          // 10 POL
        ethers.parseUnits("1000", 18),    // 1000 TOTEM
        12,                               // Species.None (random)
        28,                               // Color.None (random)
        1,                                // Rarity.Uncommon minimum
        1,                                // Rarity.Uncommon maximum
        false,                            // Not limited rarity
        0                                 // No expiry
    );

    // Weekly Rare Bundle (20 POL)
    console.log("Creating Weekly Rare Bundle...");
    await game.createBundle(
        ethers.parseEther("20"),          // 20 POL
        ethers.parseUnits("2000", 18),    // 2000 TOTEM
        12,                               // Species.None (random)
        28,                               // Color.None (random)
        2,                                // Rarity.Rare minimum
        2,                                // Rarity.Rare maximum
        false,                            // Not limited rarity
        endOfWeek                         // Expires end of this week, Sunday midnight
    );

    // Weekly Epic Bundle (50 POL)
    console.log("Creating Weekly Epic Bundle...");
    await game.createBundle(
        ethers.parseEther("50"),          // 50 POL
        ethers.parseUnits("5000", 18),    // 5000 TOTEM
        12,                               // Species.None (random)
        28,                               // Color.None (random)
        3,                                // Rarity.Epic minimum
        3,                                // Rarity.Epic maximum
        false,                            // Not limited rarity
        endOfWeek                         // Expires end of this week, Sunday midnight
    );

    // Monthly Special Bundle (250 POL)
    console.log("Creating Monthly Special Bundle...");
    await game.createBundle(
        ethers.parseEther("250"),         // 250 POL
        ethers.parseUnits("10000", 18),   // 10000 TOTEM
        1,                                // Species.Otter
        17,                               // Color.RosyPink
        5,                                // Rarity.Limited
        5,                                // Rarity.Limited
        true,                             // Is limited rarity
        monthEnd                          // Expires end of month
    );

    // Verify bundles were created
    console.log("\nVerifying bundles...");
    for(let i = 0; i < 4; i++) {
        const bundle = await game.bundles(i);
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