const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address;
    let subscriptionId;

    if (developmentChains.includes(network.name)) {
        const VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = VRFCoordinatorV2Mock.address;
        const transactionResponse = await VRFCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionResponse.wait(1);
        subscriptionId = transactionReceipt.events[0].args.subId;
        // now that we have a subscription, we need to fund the subscription;
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
    }

    const entrancFee = networkConfig[chainId]['entranceFee'];
    const gasLane = networkConfig[chainId]["gasLane"];
    const args = [vrfCoordinatorV2Address, entrancFee, gasLane]
    const lottery = await deploy("Lottery", {
        from: deployer,
        args: args,
        log: true,
        // @ts-ignore
        waitConfirmations = network.config.blockConfirmations || 1
    });
};
