const { getNamedAccounts, network, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Unit Tests", async function () {
          let lottery, VRFCoordinatorV2Mock;
          const chainId = network.config.chainId;

          beforeEach(async function () {
              const { deployer } = await getNamedAccounts();
              await deployments.fixture(["all"]);
              lottery = await ethers.getContract("Lottery", deployer);
              VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
          });

          describe("constructor", async function () {
              it("initializes the lottery correctly", async function () {
                  // Ideally we make our test have just one assert per 'it'
                  const lotteryState = await lottery.getLotteryState();
                  const interval = await lottery.getInterval();
                  assert.equal(lotteryState.toString(), "0");
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
              });
          });
      });
