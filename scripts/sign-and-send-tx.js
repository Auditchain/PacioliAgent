async function main() {
    require('dotenv').config();
    let HDWalletProvider = require('@truffle/hdwallet-provider');
    let Web3 = require('web3');


    const { API_URL, PRIVATE_KEY } = process.env;
    const private_key = "0x29722c2fb2d5fa169d381c6bad538797aa5413de929e1c2008d472b8dc65cd01";
    const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
    // const web3 = createAlchemyWeb3("https://polygon-mumbai.g.alchemy.com/v2/H2g1siLIwqCBQMIY052r_vJAejQ_A_V3");
    const web3 = createAlchemyWeb3("http://localhost:8545");

    const myAddress = '0x5A8bbBdE5bF85Ba241641403001eef87D90087f6' //TODO: replace this address with your own public address


    const NON_COHORT = require('./build/contracts/ValidationsNoCohort.json');
    const nonCohortAddress = process.env.VALIDATIONS_NO_COHORT_ADDRESS;

    // const mumbai_server = "http://localhost:8545";

    // const provider = new HDWalletProvider(private_key, mumbai_server);
    // const web3 = new Web3(provider);

    const nonce = await web3.eth.getTransactionCount(myAddress, 'latest'); // nonce starts counting from 0





    const nonCohortValidate = new web3.eth.Contract(NON_COHORT["abi"], nonCohortAddress);

    const data = nonCohortValidate.methods.validate("0xf79d556549ca32bd9cc6aadeef698601648d9f0e0b9fdd804806992812f2ae7a",
        1, myAddress, 1,
        "https://polygon-mumbai.g.alchemy.com/v2/H2g1siLIwqCBQMIY052r_vJAejQ_A_V3",
        "0xf79d556549ca32bd9cc6aadeef698601648d9f0e0b9fdd804806992812f2ae7a").encodeABI();

    console.log("data", data);



    const transaction = {
        //  'to': '0xfD39AB42e94c88fb8432FfEEeDE72672DC4a8104', 
        'to': '0xd7DB45D1Af2831C69043A7E6B916d9D8992165C9',
        'value': 0,
        'gas': 900000,
        'maxFeePerGas': 2500000001,
        'maxPriorityFeePerGas': 2500000000,
        'nonce': nonce,
        'data': data,
    };

    const signedTx = await web3.eth.accounts.signTransaction(transaction, private_key);

    web3.eth.sendSignedTransaction(signedTx.rawTransaction, function (error, hash) {
        if (!error) {
            console.log("🎉 The hash of your transaction is: ", hash, "\n Check Alchemy's Mempool to view the status of your transaction!");
        } else {
            console.log("❗Something went wrong while submitting your transaction:", error)
        }
    });
}

main();