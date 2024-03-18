const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

const BASE_FEE = ethers.parseEther("0.25");
const GAS_PRIZE_LINK = 1e9;
const args = [BASE_FEE, GAS_PRIZE_LINK];

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    if (developmentChains.includes(network.name)) {
        // deploy VRFCoordimatorV2 mock contract
        log("Local network detected. Deploying mocks....");
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            args: args,
            log: true,
            waitConfirmations: network.config.blockConfirmations || 1,
        });
        log("Mock deployed!");
    }
};

module.exports.tags = ["all", "mocks"];
