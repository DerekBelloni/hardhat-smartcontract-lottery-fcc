const { getNamedAccounts, network, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
    ? // @ts-ignore
      describe.skip
    : // @ts-ignore
      describe("Lottery Unit Tests", function () {
          let lottery, VRFCoordinatorV2Mock, lotteryEntranceFee, deployer, interval;
          const chainId = network.config.chainId;

          // @ts-ignore
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              lottery = await ethers.getContract("Lottery", deployer);
              VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
              lotteryEntranceFee = await lottery.getEntranceFee();
              interval = await lottery.getInterval();
          });

          // @ts-ignore
          describe("constructor", function () {
              // @ts-ignore
              it("initializes the lottery correctly", async () => {
                  // Ideally we make our test have just one assert per 'it'
                  const lotteryState = await lottery.getLotteryState();
                  assert.equal(lotteryState.toString(), "0");
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
              });
          });

          // @ts-ignore
          describe("enter lottery", function () {
              // @ts-ignore
              it("revert when you don't pay enough", async function () {
                  await expect(lottery.enterLottery()).to.be.revertedWith(
                      "Lottery__NotEnoughETHEntered"
                  );
              });
              // @ts-ignore
              it("records players when they enter", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  const playerFromContract = await lottery.getPlayer(0);
                  assert.equal(playerFromContract, deployer);
              });
              // @ts-ignore
              it("emits event on enter", async () => {
                  await expect(lottery.enterLottery({ value: lotteryEntranceFee })).to.emit(
                      lottery,
                      "LotteryEnter"
                  );
              });
              // @ts-ignore
              it("doesn't allow entrance when lottery is calculating", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  // We need to pretend to be a Chainlink Keeper
                  await lottery.performUpkeep([]);
                  await expect(
                      lottery.enterLottery({ value: lotteryEntranceFee })
                  ).to.be.revertedWith("Lottery__NotOpen");
              });
          });
          // @ts-ignore
          describe("checkUpkeep", function () {
              // @ts-ignore
              it("returns false if people haven't sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                  assert(!upkeepNeeded);
              });
              // @ts-ignore
              it("returns false if lottery isn't open", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
                  await lottery.performUpkeep([]);
                  const lotteryState = await lottery.getLotteryState();
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                  assert.equal(lotteryState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });
              // @ts-ignore
              it("returns false if enough time hasn't passed", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x");
                  assert(!upkeepNeeded);
              });
              // @ts-ignore
              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x");
                  assert(upkeepNeeded);
              });
          });
          // @ts-ignore
          describe("performUpkeep", function () {
              // @ts-ignore
              it("it can only run if checkUpkeep is true", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
                  const tx = await lottery.performUpkeep([]);
                  assert(tx);
              });
              // @ts-ignore
              it("reverts when checkUpkeep is false", async () => {
                  await expect(lottery.performUpkeep([])).to.be.revertedWith(
                      "Lottery__UpkeepNotNeeded"
                  );
              });
              // @ts-ignore
              it("updates the lottery state, emits an event, and calls the vrf coordinator", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const txResponse = await lottery.performUpkeep([]);
                  const txReceipt = await txResponse.wait(1);
                  const requestId = txReceipt.events[1].args.requestId;
                  const lotteryState = await lottery.getLotteryState();
                  assert(requestId.toNumber() > 0);
                  assert(lotteryState.toString() == 1);
              });
          });
          // @ts-ignore
          describe("fulfillRandomWords", function () {
              // @ts-ignore
              beforeEach(async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
              });
              // @ts-ignore
              it("can only be called after performUpkeep", async () => {
                  await expect(
                      VRFCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      VRFCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)
                  ).to.be.revertedWith("nonexistent request");
              });
              // Way too big
              // @ts-ignore
              it("picks a winner, resets the lottery, and sends money", async () => {
                  const additionalEntrants = 3;
                  const startingAccountIndex = 1;
                  const accounts = await ethers.getSigners(); // since deployer is zero index, new accounts start from index 1
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedLottery = lottery.connect(accounts[i]);
                      await accountConnectedLottery.enterLottery({ value: lotteryEntranceFee });
                  }
                  const startingTimeStamp = await lottery.getLatestTimeStamp();
                  // performUpkeep (mock being chainlink keepers)
                  // fulfillRandomWords(mock being the Chainlink VRF)
                  // Simulate that we have to wait for fulfillRandomWords to be called
                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          console.log("Found the event!");
                          try {
                              // @ts-ignore
                              const recentWinner = await lottery.getRecentWinner();
                              const lotteryState = await lottery.getLotteryState();
                              const endingTimeStamp = await lottery.getLatestTimeStamp();
                              const numPlayers = await lottery.getNumberofPlayers();
                              const winnerEndingBalance = await accounts[1].getBalance();
                              assert.equal(numPlayers.toString(), "0");
                              assert.equal(lotteryState.toString(), "0");
                              assert(endingTimeStamp > startingTimeStamp);
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  // @ts-ignore
                                  winnerStartingBalance.add(
                                      lotteryEntranceFee
                                          .mul(additionalEntrants)
                                          .add(lotteryEntranceFee)
                                          .toString()
                                  )
                              );
                          } catch (error) {
                              reject(error);
                          }
                          // @ts-ignore
                          resolve();
                      });
                      const tx = await lottery.performUpkeep([]);
                      const txReceipt = await tx.wait(1);
                      const winnerStartingBalance = await accounts[1].getBalance();
                      await VRFCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          lottery.address
                      );
                  });
              });
          });
      });
