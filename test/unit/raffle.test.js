const { assert, expect } = require("chai");
const { network, deployments, ethers, getNamedAccounts } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Test", function () {
          let raffle,
              raffleContract,
              deployer,
              vrfCoordinatorV2Mock,
              raffleEntranceFee,
              interval,
              player;
          beforeEach(async function () {
              accounts = await ethers.getSigners();
              player = accounts[1];
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["mocks", "raffle"]);
              const myRaffle = await deployments.get("Raffle");
              raffle = await ethers.getContractAt(myRaffle.abi, myRaffle.address);
              const myVrfMock = await deployments.get("VRFCoordinatorV2Mock");
              vrfCoordinatorV2Mock = await ethers.getContractAt(myVrfMock.abi, myVrfMock.address);
              raffleEntranceFee = await raffle.getEntranceFee();
              interval = await raffle.getInterval();
          });

          describe("constructor", function () {
              it("Intialization the raffle correctly", async function () {
                  const raffleState = (await raffle.getRaffleState()).toString();
                  assert.equal(raffleState, "0");
                  assert.equal(
                      interval.toString(),
                      networkConfig[network.config.chainId]["keepersUpdateInterval"],
                  );
              });
          });

          describe("enterRaffle", function () {
              it("reverts when you don't pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.rejectedWith(
                      "Raffle__NotEnoughETHEntered",
                  );
              });

              it("records player when they enter", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const playerFromContract = await raffle.getPlayers(0);
                  assert.equal(playerFromContract, deployer);
              });

              it("emits event on enter", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter",
                  );
              });
              it("doesn't allow entrance when raffle is calculating", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  // we pretend to be a keeper for a second
                  await raffle.performUpkeep("0x"); // changes the state to calculating for our comparison below
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.rejectedWith(
                      // is reverted as raffle is calculating
                      "Raffle__RaffleNotOpen",
                  );
              });
          });

          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                  assert(!upkeepNeeded);
              });
              it("returns false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  await raffle.performUpkeep("0x");
                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });
              it("returns false if enough time hasn't passed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) - 5]); // use a higher number here if this test fails
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded);
              });
              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(upkeepNeeded);
              });
          });

          describe("performUpkeep", function () {
              it("it can only run if checkupkeep is true ", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const tx = await raffle.performUpkeep("0x");
                  assert(tx);
              });

              it("reverts if checkup is false", async () => {
                  await expect(raffle.performUpkeep("0x")).to.be.rejectedWith(
                      "Raffle__UpkeepNotNeeded",
                  );
              });

              it("updates the raffle state,emits the event, and call theverf coordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const txResponse = await raffle.performUpkeep("0x");
                  const txReceipt = await txResponse.wait(1);
                  const requestId = raffle.interface.parseLog(txReceipt.logs[1]).args.requestId;
                  const raffleState = await raffle.getRaffleState();
                  assert(Number(requestId) > 0);
                  assert(raffleState.toString() == "1");
              });
          });

          describe("fulfillRandomWords", function () {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
              });
              it("can only be called after performupkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target), // reverts if not fulfilled
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.target), // reverts if not fulfilled
                  ).to.be.revertedWith("nonexistent request");
              });

              // This test is too big...
              // This test simulates users entering the raffle and wraps the entire functionality of the raffle
              // inside a promise that will resolve if everything is successful.
              // An event listener for the WinnerPicked is set up
              // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
              // All the assertions are done once the WinnerPicked event is fired
              it("picks a winner, resets, and sends money", async () => {
                  const additionalEntrances = 3; // to test
                  const startingIndex = 2;
                  let startingBalance;

                  for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                      // i = 2; i < 5; i=i+1
                      await raffle.connect(accounts[i]).enterRaffle({ value: raffleEntranceFee });
                  }
                  const startingTimeStamp = await raffle.getLastTimestamp(); // stores starting timestamp (before we fire our event)

                  // This will be more important for our staging tests...
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          // event listener for WinnerPicked
                          console.log("WinnerPicked event fired!");
                          // assert throws an error if it fails, so we need to wrap
                          // it in a try/catch so that the promise returns event
                          // if it fails.
                          try {
                              // Now lets get the ending values...
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const startingBalancePromise = ethers.provider.getBalance(
                                  accounts[2].getAddress(),
                              );
                              startingBalance = await startingBalancePromise;
                              const winnerBalance = await ethers.provider.getBalance(
                                  accounts[2].getAddress(),
                              );
                              console.log(winnerBalance.toString());
                              const endingTimeStamp = await raffle.getLastTimestamp();
                              await expect(raffle.getPlayers(0)).to.be.reverted;

                              const startingBalanceBigInt = BigInt(startingBalance.toString());
                              const raffleEntranceFeeBigInt = BigInt(raffleEntranceFee.toString());
                              const additionalEntrancesBigInt = BigInt(additionalEntrances);

                              // Perform arithmetic operations using BigInts
                              const expectedWinnerBalance = startingBalanceBigInt.toString();

                              // Comparisons to check if our ending values are correct:
                              assert.equal(recentWinner.toString(), accounts[2].address);
                              assert.equal(raffleState, 0);
                              assert.equal(winnerBalance.toString(), expectedWinnerBalance);
                              assert(endingTimeStamp > startingTimeStamp);
                              resolve(); // if try passes, resolves the promise
                          } catch (e) {
                              reject(e); // if try fails, rejects the promise
                          }
                      });

                      // kicking off the event by mocking the chainlink keepers and vrf coordinator
                      try {
                          const tx = await raffle.performUpkeep("0x");
                          const txReceipt = await tx.wait(1);
                          startingBalance = ethers.provider.getBalance(accounts[2].getAddress());
                          await vrfCoordinatorV2Mock.fulfillRandomWords(
                              raffle.interface.parseLog(txReceipt.logs[1]).args.requestId,
                              raffle.target,
                          );
                      } catch (e) {
                          reject(e);
                      }
                  });
              });
          });
      });
