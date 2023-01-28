// @ts-ignore
const { getNamedAccounts, network, deployments, ethers } = require("hardhat");
// @ts-ignore
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
// @ts-ignore
const { assert, expect } = require("chai");

developmentChains.includes(network.name)
    ? // @ts-ignore
      describe.skip
    : // @ts-ignore
      describe("Lottery Unit Tests", function () {
          // @ts-ignore
          let lottery, lotteryEntranceFee, deployer, interval;

          // @ts-ignore
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              lottery = await ethers.getContract("Lottery", deployer);
              lotteryEntranceFee = await lottery.getEntranceFee();
          });

          // @ts-ignore
          describe("fulfillRandomWords", () => {
              // @ts-ignore
              it("Works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
                  // enter the lottery
                  // @ts-ignore
                  const startingTimeStamp = await lottery.getLatestTimeStamp();
                  const accounts = await ethers.getSigners();

                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!");
                          // @ts-ignore
                          try {
                              const recentWinner = await lottery.getRecentWinner();
                              const lotteryState = await lottery.getLotteryState();
                              const winnerEndingBalance = await accounts[0].getBalance();
                              const endingTimeStamp = await lottery.getLatestTimeStamp();
                              await expect(lottery.getPlayer(0).to.be.reverted());
                              assert.equal(recentWinner.toString(), accounts[0].address);
                              assert.equal(lotteryState, 0);
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(lotteryEntranceFee).toString()
                              );
                              assert(endingTimeStamp > startingTimeStamp);
                              resolve();
                          } catch (error) {
                              console.log(error);
                              reject(error);
                          }
                      });
                      // Then entering the raffle
                      await lottery.enterLottery({ value: lotteryEntranceFee });
                      const winnerStartingBalance = await accounts[0].getBalance();
                      // this code won't complete until our listener has finished listening
                  });
                  // set up listener before we enter the lottery, in case the blockchain moves fast
                  // await lottery.enterLottery({ value: lotteryEntranceFee})
              });
          });
      });
