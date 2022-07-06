"use strict";
let Web3 = require('web3');
let ethers = require('ethers');
let axios = require("axios");
let ipfsAPI = require("ipfs-api");
const fs = require('fs');
var readline = require('readline');
var Writable = require('stream').Writable;
const prompt = require('prompt-sync')({ sigint: true });
const { createAlchemyWeb3 } = require("@alch/alchemy-web3")


const { create } = require("ipfs-http-client");

const SECRETS_PATH = process.env.SECRETS_PATH ? process.env.SECRETS_PATH : '/secrets';
const PROVIDER_MANAGER = process.env.PROVIDER_MANAGER ? process.env.PROVIDER_MANAGER : 'http://localhost:3333';

// update process.env with variables not yet defined outside
if (fs.existsSync(SECRETS_PATH)) {
    require('dotenv').config({ path: 'PacioliNode.env' }); valHash
} else if (process.env.PACIOLI_ENV)
    require('dotenv').config({ path: process.env.PACIOLI_ENV });
else
    require('dotenv').config({ path: './.env' });

const projectId = process.env.IPFS_USER;
const projectSecret = process.env.IPFS_PASSWORD;
const auth = 'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');

const ipfs = create({
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https',
    headers: {
        authorization: auth
    }
})

var mutableStdout = new Writable({
    write: function (chunk, encoding, callback) {
        if (!this.muted)
            process.stdout.write(chunk, encoding);
        callback();
    }
});

mutableStdout.muted = false;

var rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true
});

const NON_COHORT = require('../build/contracts/ValidationsNoCohort.json');
const NODE_OPERATIONS = require('../build/contracts/NodeOperations.json')
const MEMBERS = require('../build/contracts/Members.json');
const QUEUE = require('../build/contracts/Queue.json');

//TODO: this module is still copied from https://github.com/Auditchain/Reporting-Validation-Engine/tree/main/clientExamples/pacioliClient:
const pacioli = require('./pacioliClient');
const { throwError } = require('ethers/errors');
const { exit } = require('process');

// import ethereum connection strings.
const endPoint = process.env.MUMBAI_SERVER;
console.log("end point:", endPoint)


// Address for smart contracts
const nonCohortAddress = process.env.VALIDATIONS_NO_COHORT_ADDRESS;
const nodeOperationsAddress = process.env.NODE_OPERATIONS_ADDRESS;
const members = process.env.MEMBER_ADDRESS;
const queue = process.env.QUEUE_ADDRESS;

let validatorDetails = null;
let agentBornAT;
let intervalSize = 4000;
let sleepTime = 5000;
let zeroTransaction = "0x0000000000000000000000000000000000000000000000000000000000000000";
let setIntervalId;
let setVoteIntervalId;
let ipfsBase = 'https://ipfs.infura.io/ipfs/';

let nonCohortValidate;
let nodeOperationsPreEvent;
let membersContract;
let queueContract
let owner;
let validationCount = 0;
let web3;
let minValidatorCount;
let locked;

let ipfs1 = ipfsAPI('ipfs.infura.io', 5001, {
    protocol: 'https'
}) // Connect to IPFS

const GEO_CACHE_FILENAME = ".myLocation.json";
// cf. https://www.ip2location.com/web-service/ip2location :
const ipLocatorURL = `https://api.ip2location.com/v2/?key=${process.env.LOCATION_KEY}&package=WS5`;

async function fetchValidatorDetails() {
    const web3_reader = web3;

    var entityName;
    try { entityName = await membersContract.methods.user(owner, 1).call() }
    catch (ex) { console.log("EXCEPTION in fetchValidatorDetails:" + ex) };
    //BUG in this version: EXCEPTION in fetchValidatorDetails:Error: data out-of-bounds (length=3, offset=32, code=BUFFER_OVERRUN, version=abi/5.0.7)
    // To reproduce:
    // node scripts/pacioliAgent.js 0xd66f2ee9bc1eda34087ccd5e5ac699194b7a34f12fbda8e115fb2506e3740429

    var details = { nickname: entityName, address: owner };
    try {
        if (process.env.LOCATION_KEY) {
            var myLocation;
            if (fs.existsSync(GEO_CACHE_FILENAME)) {
                console.log("Loading geo location from cache...");
                myLocation = JSON.parse(fs.readFileSync(GEO_CACHE_FILENAME));
            } else {
                console.log(`Querying IP locator service at ${ipLocatorURL}...`);
                myLocation = (await axios.get(ipLocatorURL)).data;
                fs.writeFileSync(GEO_CACHE_FILENAME, JSON.stringify(myLocation));
            }
            details['country'] = myLocation.country_name;
            details['city'] = myLocation.city_name;
            details['latitude'] = myLocation.latitude;
            details['longitude'] = myLocation.longitude;
        }
    } catch (e) {
        console.log("Could not georeference: " + e);
    }
    return details;
}

/**
 * @dev {initialize smart contracts}
*/
async function setUpContracts() {

    nonCohortValidate = new web3.eth.Contract(NON_COHORT["abi"], nonCohortAddress);
    nodeOperationsPreEvent = new web3.eth.Contract(NODE_OPERATIONS["abi"], nodeOperationsAddress);
    membersContract = new web3.eth.Contract(MEMBERS["abi"], members);
    queueContract = new web3.eth.Contract(QUEUE["abi"], queue);
}



/** 
 * @dev Call Pacioli endpoint and receive report, then store it on IPFS
 * @param  {contains information about the location of the submitted report on IPFS by the data subscriber } metadataUrl
 * @param  {blockchain transaction hash} trxHash
 * @returns {location of Pacioli report on IPFS and result of validation valid or not}
 */
async function verifyPacioli(metadataUrl, trxHash) {

    const result = await ipfs1.files.cat(metadataUrl);
    const reportUrl = JSON.parse(result)["reportUrl"];
    console.log("[1 " + trxHash + "]" + "  Querying Pacioli " + reportUrl);
    // const reportContent = await pacioli.callRemote(reportUrl, trxHash, true)
    //     .catch(error => console.log("ERROR: " + error));
    const reportContent = await pacioli.callLocal(reportUrl, trxHash, true)
        .catch(error => console.log("ERROR: " + error));


    if (!reportContent)
        return [null, false];

    const jsonStringFromObject = JSON.stringify(reportContent);
    const bufRule = Buffer.from(jsonStringFromObject);

    console.log("[2 " + trxHash + "] Saving Pacioli Results to IPFS");

    const reportFile = [
        {
            path: "Pacioli.json",
            content: bufRule
        }];
    const resultPacioli = await ipfs.add(reportFile, { wrapWithDirectory: true });
    const pacioliIPFS = resultPacioli.cid + '/' + "Pacioli.json"

    console.log("[3 " + trxHash + "] Pacioli report saved at: " + ipfsBase + pacioliIPFS);

    return [pacioliIPFS, reportContent.isValid];
}



// TODO:  Use only for testing to bypass calling Pacioli
// async function verifyPacioli(metadatatUrl, trxHash) {

//     return ["QmSNQetWJuvwahuQbxJwEMoa5yPprfWdSqhJUZaSTKJ4Mg/AuditchainMetadataReport.json", 0]
// }




/**
 * @dev {Store the metadata file on IPFS}
 * @param {url of the report to validate} url 
 * @param {IFPS link of pacioli report} reportPacioliIPFSUrl 
 * @param {blockchain transaction hash} trxHash 
 * @param {if report is valid} isValid 
 * @returns urlMetadata and reportHash
 */
async function uploadMetadataToIpfs(url, reportPacioliIPFSUrl, trxHash, isValid) {

    const reportContent = (await axios.get(ipfsBase + url)).data;
    const reportHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(reportContent));

    console.log("[4 " + trxHash + "] Creating metadata file.");

    let metaDataObject = {
        reportUrl: ipfsBase + url,
        reportHash: reportHash,
        reportPacioli: ipfsBase + reportPacioliIPFSUrl,
        validatorDetails: validatorDetails,
        result: isValid
    };

    const jsonStringFromObject = JSON.stringify(metaDataObject);
    const buf = Buffer.from(jsonStringFromObject);
    const metadataFile = [
        {
            path: "AuditchainMetadataReport.json",
            content: buf
        }];

    const result = await ipfs.add(metadataFile, { wrapWithDirectory: true });
    const urlMetadata = result.cid + '/' + "AuditchainMetadataReport.json";

    console.log("[5 " + trxHash + "] Metadata created: " + ipfsBase + urlMetadata);
    return [urlMetadata, reportHash];
}




/**
 * @dev call Pacioli and pass isValid result to validation function. Save metadata file on IPFS. 
 * @param {url of the report to process} url  
 * @param {transaction hash in question} trxHash 
 * @param {hash of document in question} documentHash 
 * @param {block time transaction was initiated} initTime 
 * @param {data subscriber who initiated transaction} subscriber 
 * @returns {to be determined based on Pacioli error TODO:}
 */
async function handlePacioliIPFS(url, trxHash) {

    const [reportPacioliIPFSUrl, isValid] = await verifyPacioli(url, trxHash);

    if (!reportPacioliIPFSUrl) {
        console.log("FAILED execution of verifyPacioli for " + url);

        //TODO: what to do here?
        return [undefined, undefined, undefined];
    }

    const [metaDataLink, reportHash] = await uploadMetadataToIpfs(url, reportPacioliIPFSUrl, trxHash, isValid);
    console.log("Created metadata file for tx:", trxHash);

    return [metaDataLink, reportHash, isValid]

}




/**
 * @dev Validate the report
 * @param {hash of the document to validate} hash 
 * @param {time validation has been initiated} initTime 
 * @param {decision of the validator} choice 
 * @param {address of the validator} validator 
 */
async function validate(documentHash, initTime, choice, trxHash, valUrl, reportHash, subscriber) {

    console.log("[6 " + trxHash + "] Waiting for validation transaction to complete... ");
    const nonce = await web3.eth.getTransactionCount(owner);

    try {
        const data = nonCohortValidate.methods.validate(documentHash, initTime, subscriber, choice, valUrl, reportHash).encodeABI();
        const signedMessage = (await axios.get(`${PROVIDER_MANAGER}/sign?data=${data}`)).data;


        if (signedMessage != "Not approved call") {

            // while (locked)
            // await sleep(sleepTime);

            // locked = true;

            const receipt = await web3.eth.sendSignedTransaction(signedMessage);
            // locked = false;
            if (choice == 1)
                console.log("[7 " + receipt.transactionHash + "] Request has been validated as acceptable.")
            else
                console.log("[7 " + receipt.transactionHash + "] Request has been validated as adverse");

            validationCount++
            console.log("Total validation count:" + validationCount);
            return true;
        } else {
            console.log("This call is not approved.  nonCohortValidate.methods.validate(documentHash, initTime, subscriber, choice, valUrl, reportHash).encodeABI()");
            return false;
        }
    }
    catch (error) {
        console.log("An error occurred in event[validate] for transaction " + trxHash + "  ", error);
        // locked = false;
        return false
    }
}




/**
 * @dev {To implement wait}
 * @param {number of milliseconds to wait} ms 
 * @returns {Promise}
 */
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}




/**
 * @dev {Verify if hashes match. Validator checks hash of their own validation with the hashes of winners}
 * @param {list of validators} validators
 * @param {validation hash } valHash 
 * @returns {vote which has been determined by comparing hashes true or false} vote
 * @returns {winner address for which check was done } winnerAddress
 */

async function checkHash(validators, valHash) {

    const count = validators.length;
    const winnerSelected = Math.floor((Math.random() * count));
    const winnerAddress = validators[winnerSelected];

    console.log("[8 " + "0x" + "] Verifying winner validation for account:" + winnerAddress)

    let validation = await nonCohortValidate.methods.collectValidationResults(valHash).call();

    let winnerReportUrl, myReportUrl, winnerReportHash, myReportHash = 0;
    let times = 0;

    let winnerHashFound, ownerHashFound;
    for (let i = 0; i < validation[0].length; i++) {

        times++;

        if (validation[0][i].toLowerCase() == winnerAddress.toLowerCase()) {
            winnerReportUrl = validation[4][i];
            winnerReportHash = validation[5][i];
            winnerHashFound = true;
        }

        if (validation[0][i].toLowerCase() == owner.toLowerCase()) {
            myReportUrl = validation[4][i];
            myReportHash = validation[5][i];
            ownerHashFound = true;
        }

        if (myReportHash == 0 && i == validation[0].length - 1) {
            if (times > 5) {
                i = validation[0].length;
                console.log("[8. " + times + " ] Gave up on waiting for results of validation. Limit of retries reached.");
                return [null, null];
            }
            else {

                console.log("[8. " + times + "] It will wait for 5 sec");
                await sleep(sleepTime);
                validation = await nonCohortValidate.methods.collectValidationResults(valHash).call();
                console.log("[8. " + times + " Attempting search again");
                i = -1;
            }
        }

        if (ownerHashFound && winnerHashFound)
            i = validation[0].length;
    }
    // owner has voted and can verify

    let vote = false;

    if (winnerReportHash == myReportHash)
        vote = true;

    console.log("[9 " + "0x" + "] Winner validation verified as ", vote ? "similar." : "different.")

    return [vote, winnerAddress];
}




/**
 * @dev {Validator votes who is the winner of validation}
 * @param  {list of validators who have successfully completed validation} winners
 * @param  {votes of respective validators} votes
 * @param  {validation hash of transaction in question} validationHash
 */
async function voteWinner(winners, votes, validationHash, trxHash) {

    const nonce = await web3.eth.getTransactionCount(owner);
    try {
        const data = nonCohortValidate.methods.voteWinner(winners, votes, validationHash).encodeABI();
        const signedMessage = (await axios.get(`${PROVIDER_MANAGER}/sign?data=${data}`)).data;

        if (signedMessage != "Not approved call") {

            // while (locked)
            // await  sleep(sleepTime);

            // locked = true;
            const receipt = await web3.eth.sendSignedTransaction(signedMessage);
            // locked = false;

            let completed = await nonCohortValidate.methods.returnValidationRecord(validationHash).call();

            console.log("completed ", completed);

            console.log("[11 " + receipt.transactionHash + "] Verification of winners completed...  ");
            return true;
        } else {
            console.log("This call is not approved. nonCohortValidate.methods.voteWinner(winners, votes, validationHash).encodeABI()")
            return false;
        }
    } catch (error) {

        console.log("An error occurred in voteWinner for validation hash:", validationHash, error);
        return false;
    }

}




/**
 * @dev checks if there is any request in queue for validation
 * @param {last processed validation hash } vHash 
 */
 async function checkValQueue(vHash) {

    clearInterval(setIntervalId);
    try {

        const queueSize = await queueContract.methods.returnQueueSize().call();
        console.log("Queue size from checkValQueue:", queueSize.toString());
        let validationHash;


        if (Number(queueSize) > 0) {

            // let result;

           let result = await queueContract.methods.getNextValidation().call();
           let valResult = await nonCohortValidate.methods.isValidated(result[0]).call({ from: owner });


            if (vHash && vHash != zeroTransaction && valResult[0] != 0) {
                console.log("vHash from checkValQueue for getValidationToProcess", vHash);

                result = await queueContract.methods.getValidationToProcess(vHash).call();
            }
            // else {
            //     console.log("vHash from checkValQueue for getNextValidation", vHash);

            //     result = await queueContract.methods.getNextValidation().call();
            // }

            console.log("result from checkValQueue:", result);

            let validationHash = result[0];
            let documentHash = result[1]
            let url = result[2];
            let user = result[3];
            let initTime = result[4];

            if (vHash != validationHash && validationHash != zeroTransaction) {
                let valResult = await nonCohortValidate.methods.isValidated(validationHash).call({ from: owner });

                console.log("valResult from checkValQueue", valResult)

                console.log("is validated:", valResult[0]);
                console.log("number of validations:", valResult[1]);

                console.log("from checkValQueue", validationHash);
                if (valResult[0] == 0 && valResult[1] < minValidatorCount) {

                    try {

                        let trxHash = "0x"

                        const [metaDataLink, reportHash, isValid] = await handlePacioliIPFS(url, trxHash);

                        if (metaDataLink == undefined)
                            throw "Process aborted due to failed Pacioli response"



                        const hasExecuted = await validate(documentHash, initTime, isValid ? 1 : 2, trxHash, metaDataLink, reportHash, user);
                        // console.log("has executed in checkValQueue", hasExecuted);

                        if (hasExecuted) {
                            console.log("validation executed")
                            // await checkVoteQueue();
                            await checkValQueue(validationHash);
                        }
                        else {
                            console.log("validation failed")
                            setIntervalId = setInterval(
                                () => (checkValQueue().then(console.log(`ran ${(Date.now() - agentBornAT) / 1000} seconds`))),
                                intervalSize);
                            // await che0xd66f2ee9bc1eda34087ccd5e5ac699194b7a34f12fbda8e115fb2506e3740429ckValQueue();
                        }
                    }

                    catch (error) {
                        setIntervalId = setInterval(
                            () => (checkValQueue(vHash).then(console.log(`ran ${(Date.now() - agentBornAT) / 1000} seconds`))),
                            intervalSize);
                        console.log("after reading events or Pacioli bad response", error);
                    }
                }

                else {
                    console.log("Queue called from checkValQueue and ignored.");
                    setIntervalId = setInterval(
                        () => (checkValQueue(validationHash).then(console.log(`ran ${(Date.now() - agentBornAT) / 1000} seconds`))),
                        intervalSize);
                }

            } else {
                console.log("Queue called from checkValQueue and ignored");
                setIntervalId = setInterval(
                    () => (checkValQueue(validationHash).then(console.log(`ran ${(Date.now() - agentBornAT) / 1000} seconds`))),
                    intervalSize);
            }
        } else {
            console.log("Queue called from checkValQueue and is empty");
            setIntervalId = setInterval(
                () => (checkValQueue().then(console.log(`ran ${(Date.now() - agentBornAT) / 1000} seconds`))),
                intervalSize);
            // await checkVoteQueue();
        }
    } catch (error) {

        setIntervalId = setInterval(
            () => (checkValQueue(vHash).then(console.log(`ran ${(Date.now() - agentBornAT) / 1000} seconds`))),
            intervalSize);
        await checkVoteQueue();

        console.log(error)
    }

}



/**
 * @dev checks if there is any request in queue for a vote of winning validator
 * @param {last processed validation hash } vHash 
 */
async function checkVoteQueue(vHash) {

    clearInterval(setVoteIntervalId);
    try {

        const queueSize = await queueContract.methods.returnQueueSize().call();
        console.log("Queue size from checkVoteQueue:", queueSize.toString());
        let validationHash;

        if (Number(queueSize) > 0) {
            validationHash = await queueContract.methods.getNextValidationToVote().call();

            console.log("vHash from vote:", vHash)
            console.log("validationHash from vote:", validationHash)


            if (validationHash != zeroTransaction) {

                let hasVoted = await nonCohortValidate.methods.hasVoted(validationHash).call({ from: owner });
                let isValidated = await nonCohortValidate.methods.isValidated(validationHash).call({ from: owner });

                console.log("is validated from check vote queue:", isValidated)

                if (!hasVoted && (isValidated[0] != 0 && isValidated[1] >= minValidatorCount)) {

                    console.log("check vote queue", validationHash);

                    const trxHash = "0x";


                    const executed = await executeVote(validationHash, trxHash);
                    if (!executed) {
                        setVoteIntervalId = setInterval(
                            () => (checkVoteQueue(vHash).then(console.log(`ran ${(Date.now() - agentBornAT) / 1000} seconds`))),
                            intervalSize);
                        // await checkVoteQueue();
                    }
                    else {
                        setVoteIntervalId = setInterval(
                            () => (checkVoteQueue(validationHash).then(console.log(`ran ${(Date.now() - agentBornAT) / 1000} seconds`))),
                            intervalSize);
                        // await checkVoteQueue(validationHash);
                    }
                }
                else {
                    console.log("Queue called from checkVoteQueue and ignored");
                    setVoteIntervalId = setInterval(
                        () => (checkVoteQueue().then(console.log(`ran ${(Date.now() - agentBornAT) / 1000} seconds`))),
                        intervalSize);
                }

            } else {
                console.log("Queue called from checkVoteQueue and ignored");
                setVoteIntervalId = setInterval(
                    () => (checkVoteQueue(vHash).then(console.log(`ran ${(Date.now() - agentBornAT) / 1000} seconds`))),
                    intervalSize);
            }
        } else {
            console.log("Queue called from checkVoteQueue and is empty");
            setVoteIntervalId = setInterval(
                () => (checkVoteQueue().then(console.log(`ran ${(Date.now() - agentBornAT) / 1000} seconds`))),
                intervalSize);
        }
    } catch (error) {
        setVoteIntervalId = setInterval(
            () => (checkVoteQueue(vHash).then(console.log(`ran ${(Date.now() - agentBornAT) / 1000} seconds`))),
            intervalSize);

        console.log(error)
    }

}



/**
 * @dev It will execute vote on the winners
 * @param { validation hash} valHash 
 * @param {transaction hash} trxHash
 */
async function executeVote(valHash, trxHash) {

    let winners = [];
    let votes = [];

    let results = await nonCohortValidate.methods.collectValidationResults(valHash).call();

    for (let i = 0; i < results[0].length; i++) {
        const [vote, winner] = await checkHash(results[0], valHash);

        if (winner != null) {
            votes[i] = vote;
            winners[i] = winner;
        }
    }

    let hasVoted = await nonCohortValidate.methods.hasVoted(valHash).call({ from: owner });
    let executed = true;

    if (!hasVoted) {
        console.log("calling execution for:", valHash)
        executed = await voteWinner(winners, votes, valHash, trxHash);
    }

    return executed;

}


/**
 * @dev Initiate all variables and start checking queue
 */

async function initProcess() {

    await setUpContracts();
    validatorDetails = await fetchValidatorDetails();
    console.log("Details known about this node:");
    console.log(validatorDetails);

    const validationStruct = await nodeOperationsPreEvent.methods.nodeOpStruct(owner).call();
    const isNodeOperator = validationStruct.isNodeOperator;
    const isDelegating = validationStruct.isDelegating;
    minValidatorCount = await nonCohortValidate.methods.minValidators().call();

    console.log("min validator count:", minValidatorCount);


    if (isNodeOperator && !isDelegating) {
        console.log("Process started.");

        agentBornAT = Date.now();

        checkValQueue();
        checkVoteQueue();

    }
    else if (isDelegating)
        console.log("You can't validate because you are delegating your stake to another member. To become validator, register as Node Operator first.");

    else
        console.log("You can't validate because you are not a node operator. Please register as node operator first and restart this process.");

}

async function storePrivateKey(PROVIDER_MANAGER, privateKey) {

    try {
        await axios.get(`${PROVIDER_MANAGER}/storePrivateKey?privateKey=` + privateKey);
    } catch (error) {

        console.log("WARNING  - Signer Manager is not running: " + error);
    }
}


/**
 * @dev {in case user wants to use keystore file trigger this function}
 * @param {location of keystore file} ans 
 */
async function handleKeyStoreLogin(ans) {

    try {
        let keyStore = fs.readFileSync(ans, 'utf8');
        const keyStoreObject = JSON.parse(keyStore);
        mutableStdout.muted = false;

        rl.question('Password: ', async function (password) { // Promises variant available only on node 17
            try {

                console.log('\n');

                let decryptedKeyStore = web3.eth.accounts.decrypt(keyStoreObject, password);
                const { privateKey } = decryptedKeyStore;

                storePrivateKey(PROVIDER_MANAGER, privateKey);
                owner = (await axios.get(`${PROVIDER_MANAGER}/getPublicKey`)).data;

                readline.moveCursor(process.stdout, 0, -3);
                readline.clearScreenDown(process.stdout);

                console.log("Login successful");

                mutableStdout.muted = true;
                rl.close();
                initProcess();

            } catch (error) {
                console.log("Check your password and try again. ");
                console.log(error);
                process.exit(1);
            }
        });

    } catch (error) {

        console.log("Your keystore file couldn't be opened. Please check your file location and try again.");
        process.exit(1);
    }
}


/**
 * @dev Request private key and initialize Signing manager
 */
async function startProcess() {

    // handle keystore file or private key
    let privateKey;
    try {

        // web3 = new Web3(endPoint);
        web3 = createAlchemyWeb3(endPoint);
        owner = (await axios.get(`${PROVIDER_MANAGER}/getPublicKey`)).data;

        if (!owner || owner == "Not initialized") {

            let ans = prompt('Enter location of your Keystore file (OR JUST THE PRIVATE KEY):  ').trim();

            if (ans.startsWith('key') || ans.startsWith('/')) {
                await handleKeyStoreLogin(ans);
            } else if (ans.startsWith('0x') || ans.length==64) {
                privateKey = ans;
                if (!privateKey.startsWith('0x'))
                    privateKey = '0x'+privateKey;
                storePrivateKey(PROVIDER_MANAGER, privateKey);
                owner = (await axios.get(`${PROVIDER_MANAGER}/getPublicKey`)).data;
                initProcess();
            } else {
                console.log("No private key provided.");
                exit(0);
            }
        } else {
            console.log("Owner already known, ready for operation")
            initProcess();
        }

    } catch (error) {

        if (JSON.stringify(error).indexOf("connect ECONNREFUSED 127.0.0.1:3333") > -1) {
            console.log("Signer Manager is not running. Ensure that Signer Manager is running before you run Pacioli Manager");
            exit(0)
        }
    }
}


if (process.env.TEST_RUNS) {
    const reports = [
        "https://xbrlsite.azurewebsites.net/2021/reporting-scheme/proof/reference-implementation/instance.xml",
        "https://www.sec.gov/Archives/edgar/data/1318605/000095017021000046/tsla-20210331.htm",
        "https://www.sec.gov/Archives/edgar/data/789019/000156459020034944/msft-10k_20200630_htm.xml",
        "https://www.sec.gov/Archives/edgar/data/1108524/000110852417000040/crm-20171031.xml",
    ];

    let N = parseInt(process.env.TEST_RUNS);
    if (N < 1 || N > 20) throw ("Bad TEST_RUNS");

    for (var i = 0; i < N; i++) {
        const reportURL = reports[i % reports.length];
        console.log(`Calling Pacioli with ${reportURL} (${i})`);
        pacioli.callLocal(reportURL, "dummyTx" + i, true).then(function (result) {
            console.log("Result for " + reportURL + ": " + JSON.stringify(result));
        }).catch(function (error) {
            console.log("Error for " + reportURL + ": " + JSON.stringify(error));
        });
    }

} else startProcess();
