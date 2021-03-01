import { setJupiterAccountDetails, createAccount, verifyIdentity } from '../dec-auth.js';

// Holds the applications funded & public key enabled
// master Jupiter account identifier.
let jupAccountId = "";
// Holds the master Jupiter account's password.
let jupPassphrase = "";
// Holds the master Jupiter account's public keyp.
let jupPublicKey = "";


setJupiterAccountDetails(null, jupAccountId, jupPassphrase);

let username = "newAccount-" + new Date().getTime();
let password = "pass1";

console.log("username: ", username);
console.log("password: ", password);

let res = await createAccount(username, password, {goodAcc: true}, {hidden: true});

console.log("account was succesfully created? ", res);

console.log("account verification passed? ", await verifyIdentity(username, password));

