"use strict";
let express = require('express');
let bodyParser = require('body-parser');
let Web3 = require('web3');
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
require('dotenv').config({ path: '.env' }); // update process.env.
// let Web3 = require('web3');



const nonCohortAddress = process.env.VALIDATIONS_NO_COHORT_ADDRESS;
const endPoint = process.env.MUMBAI_SERVER;


// const web3 = createAlchemyWeb3(endPoint);

const fs = require('fs');

let app = express();
let privateKey;
let publicKey;
let nonce;


let web3 = new Web3(endPoint);




async function testGas(){

    let gas = await web3.eth.estimateGas({
        to: nonCohortAddress,
        from: "0x5A8bbBdE5bF85Ba241641403001eef87D90087f6",
        data: "0x87c77617",
    })

    console.log("gas:", gas);
    


}

testGas();