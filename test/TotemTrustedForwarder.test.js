const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TotemTrustedForwarder", function () {
    let TotemTrustedForwarder;
    let forwarder;
    let MockTarget;
    let mockTarget;
    let owner, user1, user2;
    let maxGasPrice = ethers.parseUnits("50", "gwei");

    beforeEach(async function () {
        // Get signers
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy TotemTrustedForwarder
        TotemTrustedForwarder = await ethers.getContractFactory("TotemTrustedForwarder");
        forwarder = await TotemTrustedForwarder.connect(owner).deploy(maxGasPrice);

        // Deploy a mock target contract for testing
        MockTarget = await ethers.getContractFactory("MockTarget");
        mockTarget = await MockTarget.connect(owner).deploy();

        // Whitelist the target contract in the forwarder
        await forwarder.connect(owner).setContractStatus(await mockTarget.getAddress(), true);
    });

    describe("Initialization", function () {
        it("Should set the max gas price correctly", async function () {
            expect(await forwarder.maxGasPrice()).to.equal(maxGasPrice);
        });

        it("Should set the deployer as the owner", async function () {
            expect(await forwarder.owner()).to.equal(owner.address);
        });
    });

    describe("Contract Whitelisting", function () {
        it("Should allow the owner to whitelist a contract", async function () {
            const targetAddress = ethers.Wallet.createRandom().address;
            await forwarder.connect(owner).setContractStatus(targetAddress, true);
            expect(await forwarder.allowedContracts(targetAddress)).to.be.true;
        });

        it("Should allow the owner to remove a contract from the whitelist", async function () {
            const mockAddress = await mockTarget.getAddress();
            expect(await forwarder.allowedContracts(mockAddress)).to.be.true;

            await forwarder.connect(owner).setContractStatus(mockAddress, false);
            expect(await forwarder.allowedContracts(mockAddress)).to.be.false;
        });

        it("Should revert when setting zero address as contract", async function () {
            await expect(forwarder.connect(owner).setContractStatus(ethers.ZeroAddress, true))
                .to.be.revertedWithCustomError(forwarder, "InvalidContractAddress");
        });

        it("Should revert when non-owner tries to whitelist a contract", async function () {
            const targetAddress = ethers.Wallet.createRandom().address;
            await expect(forwarder.connect(user1).setContractStatus(targetAddress, true))
                .to.be.revertedWithCustomError(forwarder, "OwnableUnauthorizedAccount")
                .withArgs(user1.address);
        });

        it("Should allow batch whitelisting of contracts", async function () {
            const addresses = [
                ethers.Wallet.createRandom().address,
                ethers.Wallet.createRandom().address,
                ethers.Wallet.createRandom().address
            ];
            const statuses = [true, false, true];

            await forwarder.connect(owner).batchSetContractStatus(addresses, statuses);

            expect(await forwarder.allowedContracts(addresses[0])).to.equal(statuses[0]);
            expect(await forwarder.allowedContracts(addresses[1])).to.equal(statuses[1]);
            expect(await forwarder.allowedContracts(addresses[2])).to.equal(statuses[2]);
        });

        it("Should revert batch whitelisting when arrays have different lengths", async function () {
            const addresses = [
                ethers.Wallet.createRandom().address,
                ethers.Wallet.createRandom().address
            ];
            const statuses = [true];

            await expect(forwarder.connect(owner).batchSetContractStatus(addresses, statuses))
                .to.be.revertedWithCustomError(forwarder, "MismatchedArrayLengths");
        });

        it("Should revert batch whitelisting with zero address", async function () {
            const addresses = [
                ethers.Wallet.createRandom().address,
                ethers.ZeroAddress
            ];
            const statuses = [true, true];

            await expect(forwarder.connect(owner).batchSetContractStatus(addresses, statuses))
                .to.be.revertedWithCustomError(forwarder, "InvalidContractAddress");
        });
    });

    describe("Max Gas Price Management", function () {
        it("Should allow the owner to update max gas price", async function () {
            const newMaxGasPrice = ethers.parseUnits("100", "gwei");
            await forwarder.connect(owner).setMaxGasPrice(newMaxGasPrice);
            expect(await forwarder.maxGasPrice()).to.equal(newMaxGasPrice);
        });

        it("Should revert when non-owner tries to update max gas price", async function () {
            const newMaxGasPrice = ethers.parseUnits("100", "gwei");
            await expect(forwarder.connect(user1).setMaxGasPrice(newMaxGasPrice))
                .to.be.revertedWithCustomError(forwarder, "OwnableUnauthorizedAccount")
                .withArgs(user1.address);
        });
    });

    describe("Nonce Management", function () {
        it("Should return the correct nonce for an address", async function () {
            const nonce = await forwarder.getNonce(user1.address);
            expect(nonce).to.equal(0n);
        });

        it("Should increment nonce after successful relay", async function () {
            // Will be implemented in the Relay section
        });
    });

    describe("EIP-712 Signature Verification", function () {
        it("Should correctly generate domain separator", async function () {
            const domain = await forwarder.domainSeparator();
            expect(domain).to.not.equal(ethers.ZeroHash);
        });

        // More tests for signature verification will be added in the relay tests
    });

    describe("Meta-transaction Relay", function () {
        let mockFunctionData;
        let mockRequest;
        let domain;

        beforeEach(async function () {
            // Get the contract domain
            const name = "TotemTrustedForwarder";
            const version = "1";
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const verifyingContract = await forwarder.getAddress();

            domain = {
                name,
                version,
                chainId,
                verifyingContract
            };

            // Create mock function call data for target contract
            mockFunctionData = mockTarget.interface.encodeFunctionData("executeFunction", ["Hello World"]);

            // Create a request to be signed and forwarded
            mockRequest = {
                from: user1.address,
                to: await mockTarget.getAddress(),
                value: 0,
                gas: 1000000,
                nonce: await forwarder.getNonce(user1.address),
                data: mockFunctionData
            };
        });

        it("Should relay a valid transaction correctly", async function () {
            // Create EIP-712 signature
            const types = {
                ForwardRequest: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "gas", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "data", type: "bytes" }
                ]
            };

            const signature = await user1.signTypedData(domain, types, mockRequest);

            // Execute relay
            const relayTx = await forwarder.connect(user2).relay(mockRequest, signature);
            const receipt = await relayTx.wait();

            // Verify the relay was successful
            const metaExecutedEvents = receipt.logs.filter(
                log => log.fragment && log.fragment.name === 'MetaTransactionExecuted'
            );
            expect(metaExecutedEvents.length).to.equal(1);

            // Check target contract state was updated
            expect(await mockTarget.lastCaller()).to.equal(user1.address);
            expect(await mockTarget.lastMessage()).to.equal("Hello World");

            // Check nonce was incremented
            expect(await forwarder.getNonce(user1.address)).to.equal(1n);
        });

        it("Should revert when relaying to non-whitelisted contract", async function () {
            // Deploy a new contract that isn't whitelisted
            const newMockTarget = await MockTarget.connect(owner).deploy();

            // Update request with non-whitelisted contract
            const invalidRequest = { ...mockRequest, to: await newMockTarget.getAddress() };

            // Create signature
            const types = {
                ForwardRequest: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "gas", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "data", type: "bytes" }
                ]
            };

            const signature = await user1.signTypedData(domain, types, invalidRequest);

            // Try to relay
            await expect(forwarder.connect(user2).relay(invalidRequest, signature))
                .to.be.revertedWithCustomError(forwarder, "UnauthorizedContract");
        });

        it("Should revert when signature is invalid", async function () {
            // Create a valid request
            const validRequest = mockRequest;

            // But sign it with the wrong signer
            const types = {
                ForwardRequest: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "gas", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "data", type: "bytes" }
                ]
            };

            // User2 signs a transaction claiming to be from user1
            const invalidSignature = await user2.signTypedData(domain, types, validRequest);

            // Try to relay
            await expect(forwarder.connect(user2).relay(validRequest, invalidSignature))
                .to.be.revertedWithCustomError(forwarder, "InvalidSignature");
        });

        it("Should revert when nonce is invalid", async function () {
            // Create request with incorrect nonce
            const invalidRequest = { ...mockRequest, nonce: 42 };

            // Create signature
            const types = {
                ForwardRequest: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "gas", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "data", type: "bytes" }
                ]
            };

            const signature = await user1.signTypedData(domain, types, invalidRequest);

            // Try to relay
            await expect(forwarder.connect(user2).relay(invalidRequest, signature))
                .to.be.revertedWithCustomError(forwarder, "InvalidNonce");
        });

        it("Should revert when relay target function reverts", async function () {
            // Create request that will trigger a revert in the target
            const revertFunctionData = mockTarget.interface.encodeFunctionData("revertingFunction");
            const revertRequest = { ...mockRequest, data: revertFunctionData };

            // Create signature
            const types = {
                ForwardRequest: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "gas", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "data", type: "bytes" }
                ]
            };

            const signature = await user1.signTypedData(domain, types, revertRequest);

            // Try to relay
            await expect(forwarder.connect(user2).relay(revertRequest, signature))
                .to.be.revertedWithCustomError(forwarder, "TransactionFailed");
        });
    });
});
