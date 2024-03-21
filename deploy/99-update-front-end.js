const { ethers, network } = require("hardhat");
const fs = require("fs");

const frontEndContractsFile = "../smart-contract-nextjs-frontend/constants/contractAddresses.json";
const frontEndAbiFile = "../smart-contract-nextjs-frontend/constants/abi.json";
module.exports = async function () {
    if (process.env.UPADATE_FRONT_END) {
        console.log("Updating the FrontEnd");
    }
    updateContractAddress();
    updateAbi();
    console.log("Front end written!");
};

async function updateAbi() {
    const myRaffle = await deployments.get("Raffle");
    const raffle = await ethers.getContractAt(myRaffle.abi, myRaffle.address);
    fs.writeFileSync(frontEndAbiFile, raffle.interface.formatJson());
}
async function updateContractAddress() {
    const myRaffle = await deployments.get("Raffle");
    const raffle = await ethers.getContractAt(myRaffle.abi, myRaffle.address);
    const chainId = network.config.chainId.toString();
    const currentAddress = JSON.parse(fs.readFileSync(frontEndContractsFile, "utf8"));

    if (chainId in currentAddress) {
        if (!currentAddress[chainId].includes(raffle.target)) {
            currentAddress[chainId].push(raffle.target);
        }
    }
    {
        currentAddress[chainId] = [raffle.target];
    }
    fs.writeFileSync(frontEndContractsFile, JSON.stringify(currentAddress));
}
module.exports.tags = ["all", "frontend"];
