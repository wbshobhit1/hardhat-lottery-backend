const { ethers } = require("hardhat");

async function enterRaffle() {
    const myRaffle = await deployments.get("Raffle");
    const raffle = await ethers.getContractAt(myRaffle.abi, myRaffle.address);
    const entranceFee = await raffle.getEntranceFee();
    await raffle.enterRaffle({ value: entranceFee });
    console.log(`Entered! ${entranceFee}`);
}

enterRaffle()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
