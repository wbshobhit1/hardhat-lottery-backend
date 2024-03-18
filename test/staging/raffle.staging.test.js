const { assert, expect } = require("chai");
const { network, deployments, ethers, getNamedAccounts } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Stage Test", function () {
          let raffle, deployer, raffleEntranceFee;
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              const myRaffle = await deployments.get("Raffle");
              raffle = await ethers.getContractAt(myRaffle.abi, myRaffle.address);
              raffleEntranceFee = await raffle.getEntranceFee();
          });

          describe("fulfillRandomWords", function () {
              it("works with live Chainlink keepers and Chainlink VRF, we get a random winner", async function () {
                  const startingTimeStamp = await raffle.getLastTimestamp();
                  const accounts = await ethers.getSigners();

                  console.log("Setting up Listener...");

                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!");
                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerEndingBalance = await ethers.provider.getBalance(
                                  accounts[0].getAddress(),
                              );
                              const endingTimeStamp = await raffle.getLastTimestamp();

                              await expect(raffle.getPlayers(0)).to.be.reverted;
                              assert.equal(recentWinner.toString(), accounts[0].address);
                              assert.equal(raffleState, 0);
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  (winnerStartingBalance + raffleEntranceFee).toString(),
                              );
                              assert(endingTimeStamp > startingTimeStamp);
                              resolve();
                          } catch (error) {
                              console.log(error);
                              reject(e);
                          }
                      });
                      console.log("Entering Raffle...");
                      const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
                      await tx.wait(1);
                      const winnerStartingBalance = await ethers.provider.getBalance(
                          accounts[0].getAddress(),
                      );
                  });
              });
          });
      });
