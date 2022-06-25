"use strict";
let express = require('express');
let bodyParser = require('body-parser');
let Web3 = require('web3');
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
require('dotenv').config({ path: '.env' }); // update process.env.


const nonCohortAddress = process.env.VALIDATIONS_NO_COHORT_ADDRESS;
const endPoint = process.env.MUMBAI_SERVER;

const web3 = createAlchemyWeb3(endPoint);

const fs = require('fs');

let app = express();
let privateKey;
let publicKey;
let nonce;

app.use(express.static('private'));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

// Add headers

app.use(function (req, res, next) {

    // Website you wish to allow to connect

    let allowedOrigins = ['http://localhost:8181'];
    let origin = req.headers.origin;
    if (allowedOrigins.indexOf(origin) > -1) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

async function sign(data) {


    try {

        if (data.startsWith("0x42d47412") || data.startsWith("0xd4632bcf")) {
            const testNonce = await web3.eth.getTransactionCount(publicKey, 'latest'); // nonce starts counting from 0

            if (testNonce > nonce)
                nonce = testNonce;
           
            let gas;

            if (data.startsWith("0x42d47412"))
                gas = 9000000
            else
                gas = 8000000;

            const transaction = {
                'to': nonCohortAddress,
                'value': 0,
                'gas': gas,
                'maxFeePerGas': 2500000000,
                'maxPriorityFeePerGas': 2500000000,
                'nonce': nonce,
                'data': data,
            };

            nonce++;

            const signedTx = await web3.eth.accounts.signTransaction(transaction, privateKey);
            return signedTx.rawTransaction;
        }
        else
            return "Not approved call";
    } catch (error) {
        console.log(error);
    }
}

async function getNonce() {
    nonce = await web3.eth.getTransactionCount(publicKey, 'latest');
    return nonce;

}


app.get('/storePrivateKey', async function (req, res) {

    privateKey = req.query.privateKey
    publicKey = web3.eth.accounts.privateKeyToAccount(privateKey).address;
    // owner = provider.addresses[0];
    // nonce = getNonce();
    nonce = await web3.eth.getTransactionCount(publicKey, 'latest');
    console.log("Key created from:", req.ip, new Date());
    console.log("public key:", publicKey);
    console.log("starting nonce:", nonce);
    console.log('\n');

    res.end();
});


app.get('/getPublicKey', function (req, res) {
    console.log("Public Key accessed from:", req.ip, new Date());
    console.log('\n');

    if (privateKey)
        res.end(web3.eth.accounts.privateKeyToAccount(privateKey).address);
    else
        res.end("Not initialized");

})

app.get('/sign', async function (req, res) {

    let data = req.query.data;

    try {
        console.log("Signature requested:", req.ip, new Date());
        console.log("data:", data);
        console.log('\n');

        const signedTx = await sign(data);
        res.end(JSON.stringify(signedTx));

    } catch (err) {
        console.log(err);
        res.end(err);
    }
})


let server = app.listen(3333, function () {
    let host = server.address().address
    let port = server.address().port
    console.log("Example app listening at http://%s:%s", host, port)

})