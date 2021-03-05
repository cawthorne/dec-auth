import { setJupiterAccountDetails, createAccount, verifyIdentity, deleteAllAccounts, retrieveAccount, retrieveAccountData,
    retrieveAccountData, retrieveAccountSensitiveData, changeAccountPassword, changeAccountUsername } from '../dec-auth.js';
import { strict as assert } from 'assert';

// Holds the applications funded & public key enabled
// master Jupiter account identifier.
let jupAccountId = "";
// Holds the master Jupiter account's password.
let jupPassphrase = "";
// Holds the master Jupiter account's public keyp.
let jupPublicKey = "";


setJupiterAccountDetails(null, jupAccountId, jupPassphrase);

// WARNING, DO NOT RUN THIS ON A PRODUCTION ACCOUNT. WILL DELETE ALL COUNTS.
await deleteAllAccounts();

const username = "newAccount-" + new Date().getTime();
const newUsername = "NEW-" + username;
const password = "pass1";
const newPassword = "passX1";
const badPass = "wfbkqufbhqelfbqefbhqebhqf";

const newMetaData = {goodAccChanged: true};
const newSensitiveData = {secretVal: 13};

const newMetaData2 = {goodAccChanged2: true};
const newSensitiveData2 = {secretVal: 17};

console.log("username: ", username);
console.log("password: ", password);

let accountCreated = await createAccount(username, password, {goodAcc: true}, {hidden: true, secretVal: 7});

console.log("account was succesfully created? ", accountCreated);

assert(accountCreated);

let accountCreatedTwice = await createAccount(username, password, {goodAcc: true}, {hidden: true, secretVal: 7});

console.log("account with same username failed (should fail): ", accountCreatedTwice);

assert(!accountCreatedTwice);

let verificationPassed = await verifyIdentity(username, password);

console.log("account verification passed? ", verificationPassed);

assert(verificationPassed);

let badVerification = await verifyIdentity(username, badPass);

console.log("bad password verification failed? ", !badVerification);

assert(!badVerification);

let account = await retrieveAccount(username, password)

assert(account.userKey == username);

console.log("get account: ", account);

const accountData = await retrieveAccountData(username, password);

assert(accountData.sensitiveData != null && accountData.sensitiveData['hidden']);

console.log("get account data: ", accountData);

console.log("change account password: ", await changeAccountPassword(username, password, newPassword));

let oldVerification = await verifyIdentity(username, password);

console.log("account verification (old password, should fail)? ", oldVerification);

assert(!oldVerification);

let newVerification = await verifyIdentity(username, newPassword);

console.log("account verification (new pass, should work)? ", newVerification);

assert(newVerification);

console.log("changing account username: ", await changeAccountUsername(username, newUsername, newPassword));

const newUsernameAccountData = await retrieveAccountData(newUsername, password);

let sensitiveDataCheck = (accountData.sensitiveData['secretVal'] == newUsernameAccountData.sensitiveData['secretVal']);

console.log("sensitiveData preserved during username change: ", sensitiveDataCheck);

assert(sensitiveDataCheck);

let metaDataCheck = (accountData.metaData['goodAcc'] && newUsernameAccountData.metaData['goodAcc']);

console.log("metaData preserved during username change: ", metaDataCheck);

assert(metaDataCheck);

console.log("changing account meta data: ", await changeAccountMetaData(newUsername, newMetaData));

const newAccountMetaData = await retrieveAccountMetaData(newUsername);

let accountMetaDataChangedCheck = (newUsernameAccountData.metaData['goodAcc'] && newAccountMetaData['goodAccChanged']);

console.log("metaData correctly updated: ", accountMetaDataChanged);

assert(accountMetaDataChangedCheck);

const unchangedSensitiveData = await retrieveAccountSensitiveData(newUsername, newPassword);

let sensitiveDataNotChangedCheck = (accountData.sensitiveData['secretVal'] == unchangedSensitiveData['secretVal']);

console.log("sensitive data not changed after meta data update: ", sensitiveDataNotChangedCheck);

assert(sensitiveDataNotChangedCheck);

console.log("changing account meta data: ", await changeAccountSensitiveData(newUsername, newPassword, newSensitiveData));

const newAccountSensitiveData = await retrieveAccountSensitiveData(newUsername, newPassword);

let accountSensitiveDataChangedCheck = (newAccountSensitiveData['secretVal'] == newSensitiveData['secretVal']);

console.log("sensitiveData correctly updated: ", accountSensitiveDataChangedCheck);

assert(accountSensitiveDataChangedCheck);

const unchangedMetaData = await retrieveAccountMetaData(newUsername);

let metaDataNotChangedCheck = (newAccountMetaData['goodAccChanged'] && unchangedMetaData['goodAccChanged']);

console.log("meta data not changed after sensitive data update: ", metaDataNotChangedCheck);

console.log("changing account meta and sensitive data: ", await changeAccountData(newUsername, newPassword, newMetaData2, newSensitiveData2));

const newNewAccountData = await retrieveAccountData(newUsername);

let newNewAccountDataChange = (newNewAccountData.metaData['goodAccChanged2'] &&
                               newNewAccountData.sensitiveData['secretVal'] == newSensitiveData2['secretVal']);

console.log("Changeing both meta and sensitive tests at the same time succeeded: ", newNewAccountDataChange);

assert(newNewAccountDataChange);

console.log("testing finished");