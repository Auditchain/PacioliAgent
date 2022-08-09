require('babel-register');
require('babel-polyfill');
var dotenv = require("dotenv");
dotenv.config();




// const HDWalletProvider = require("truffle-hdwallet-provider");
const HDWalletProvider = require("@truffle/hdwallet-provider");

const MNEMONIC = process.env.MNEMONIC
const INFURA_KEY = process.env.INFURA_KEY

console.log("Infura key:" + process.env.INFURA_KEY);

if (!MNEMONIC || !INFURA_KEY) {


  console.error("Please set a mnemonic and infura key...")
  return
}

module.exports = {

  plugins: [
    'truffle-plugin-verify'
  ],

  api_keys: {
    // etherscan: "SK5S23AZ5KVEZKDASHKMBZ11Z4DQ5JN5SZ" //ethereum
    etherscan: "44WCPAKSWMD4VD34G4JHBGPNVY1FV52RZT" // main polygon
    
  },
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      // gas: 6721975,
      gas: 10000000,
      gasPrice: 1000000000,
      network_id: "*", // Match any network id
      accounts: 10,
      defaultEtherBalance: 1000,
      blockTime: 3
    },

    ropsten: {
      provider: function () {
        return new HDWalletProvider(
          MNEMONIC,
          "https://ropsten.infura.io/v3/" + INFURA_KEY
        );
      },
      network_id: 3,
      gas: 4500000,
      gasPrice: 1000000000
    },
    rinkeby: {
      provider: function () {
        return new HDWalletProvider(
          MNEMONIC,
          "https://rinkeby.infura.io/v3/" + INFURA_KEY
        );
      },
      network_id: "4",
      etherscan: "SK5S23AZ5KVEZKDASHKMBZ11Z4DQ5JN5SZ",
      gas: 10000000


    },
    goerli: {
      provider: function () {
        return new HDWalletProvider(
          MNEMONIC,
          "https://goerli.infura.io/v3/" + INFURA_KEY
          // "wss://goerli.infura.io/ws/v3/2645f5383f544588975db84a58cd9af6"
          
        );
      },
      network_id: "*",
      gas: 0x989680,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      websocket: true,
      timeoutBlocks: 50000,
      networkCheckTimeout: 1000000,
      skipDryRun: true

    },
    matic: {
      provider: () => new HDWalletProvider(MNEMONIC, "https://polygon-mumbai.infura.io/v3/5250187d69d747f392fcf1d32bbbc64a"),
      networkCheckTimeout: 10000,
      ChainID: 80001,
      network_id: 80001,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    polygon: {
      provider: () => new HDWalletProvider(MNEMONIC, "https://polygon-mainnet.infura.io/v3/5250187d69d747f392fcf1d32bbbc64a"),
      networkCheckTimeout: 10000,
      ChainID: 137,
      network_id: 137,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: true,
      // gasLimit: 6706583,
    },
    coverage: {
      host: 'localhost',
      network_id: '*',
      port: 8545,
      // gas: 0xfffffffffff,
      gas: 10000000,
      gasPrice: 0x01,
    },
    live: {
      network_id: 1,
      provider: function () {
        return new HDWalletProvider(
          MNEMONIC,
          "https://mainnet.infura.io/v3/" + INFURA_KEY
        );
      },
      gas: 6721975,
      gasPrice: 65000000000,
      etherscan: "SK5S23AZ5KVEZKDASHKMBZ11Z4DQ5JN5SZ",
    },
    mocha: {
      reporter: 'eth-gas-reporter',
      reporterOptions: {
        currency: 'USD',
        gasPrice: 2
      }
    },
  },
  compilers: {
    solc: {
      version: '0.8.0',
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
 },

};

