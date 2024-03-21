const { ethers, network } = require("hardhat");

async function mockKeepers() {
    const myRaffle = await deployments.get("Raffle");
    const raffle = await ethers.getContractAt(myRaffle.abi, myRaffle.address);
    const checkData = ethers.keccak256(ethers.toUtf8Bytes(""));
    const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(checkData);
    if (upkeepNeeded) {
        const tx = await raffle.performUpkeep(checkData);
        const txReceipt = await tx.wait(1);
        const requestId = raffle.interface.parseLog(txReceipt.logs[1]).args.requestId;
        console.log(`Performed upkeep with RequestId: ${requestId}`);
        if (network.config.chainId == 31337) {
            await mockVrf(requestId, raffle);
        }
    } else {
        console.log("No upkeep needed!");
    }
}

async function mockVrf(requestId, raffle) {
    console.log("We on a local network? Ok let's pretend...");
    const myVrfMock = await deployments.get("VRFCoordinatorV2Mock");
    const vrfCoordinatorV2Mock = await ethers.getContractAt(myVrfMock.abi, myVrfMock.address);
    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.target);
    console.log("Responded!");
    const recentWinner = await raffle.getRecentWinner();
    console.log(`The winner is: ${recentWinner}`);
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
