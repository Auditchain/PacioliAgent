// import fetch from 'node-fetch';

let fetch = require('node-fetch');


async function getAddress() {
    const address = process.argv[2];
    if (!address) {
        console.log(`Please add the address as script argument`);
        process.exit(1);
    }
    return address;
};


async function getMatic(address) {
    console.log(`fetching matic to ‘${address}’`);

    
   await fetch(`https://api.faucet.matic.network/transferTokens`, {
        method: "POST",
        body: JSON.stringify({
            network: 'mumbai',
            address: '0x06997173F50DDD017a5f0A87480Ed7220039B46e',
            token: 'maticToken',
        }),
        // headers: { 'Content- Type': 'application/json' },
    }).then(res => res.json()).then(console.log)
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    // const delay = async (ms) => setTimeout(resolve, ms);
    console.log(`waiting 2 minutes`);
    await delay(2 * 60000);
};
// const address = getAddress();
getMatic();