import { setJupiterAccountDetails, createAccount, verifyIdentity, deleteAllAccounts, retrieveAccount,
    retrieveAccountData, retrieveAccountMetaData, retrieveAccountSensitiveData, changeAccountData,
    changeAccountMetaData, changeAccountSensitiveData, changeAccountPassword, changeAccountUsername,
    setTestAccount, setFirstLastBlockIndex } from '../dec-auth.js';

// Holds the applications funded & public key enabled
// master Jupiter account identifier.
let jupAccountId = "";
// Holds the master Jupiter account's password.
let jupPassphrase = "";
// Holds the master Jupiter account's public keyp.
let jupPublicKey = "";

const assert = function(bool) {
    if (bool)
        return;
    else
        throw new Error("Assert failed!!!");
}

function sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
        currentDate = Date.now();
    } while (currentDate - date < (milliseconds*1000));
}

function print(text, extra){
    if (extra != null)
        console.log("TEST: " + text, extra);
    else
        console.log("TEST: " + text);
}

 
async function runTests(sleepSeconds) { 
    print("DEC-AUTH Tests starting: " +
        (sleepSeconds == 0 ?
            " Pauses disabled" :
           ("sleep time between calls: " + sleepSeconds + "(s)")));

    print("Please make sure you have added a funded, JUP account wiht public key assigned.")
    setJupiterAccountDetails(null, jupAccountId, jupPassphrase);

    setFirstLastBlockIndex(0, 100);

    // WARNING, DO NOT RUN deleteAllAccounts ON A PRODUCTION ACCOUNT.
    // WILL DELETE ALL ACCCOUNTS.
    //await deleteAllAccounts();
    sleep(1);

    const username = "newAccount-" + new Date().getTime();
    setTestAccount(username);

    const newUsername = "NEW-" + username;
    const password = "pass1";
    const newPassword = "passX1";
    const badPass = "wfbkqufbhqelfbqefbhqebhqf";

    const newMetaData = {goodAccChanged: true};
    const newSensitiveData = {secretVal: 13};

    const newMetaData2 = {goodAccChanged2: true};
    const newSensitiveData2 = {secretVal: 17};

    print("username: ", username);
    print("password: ", password);

    let accountCreated = await createAccount(username, password, {goodAcc: true}, {hidden: true, secretVal: 7});

    print("account was succesfully created? (true => correct): ", accountCreated);

    assert(accountCreated);

    sleep(sleepSeconds);

    let accountCreatedTwice = await createAccount(username, password, {goodAcc: true}, {hidden: true, secretVal: 7});

    print("account with same username fails (true => correct): ", !accountCreatedTwice);

    assert(!accountCreatedTwice);

    sleep(sleepSeconds);

    let verificationPassed = await verifyIdentity(username, password);

    print("account verification passed? (true => correct): ", verificationPassed);

    assert(verificationPassed);

    sleep(sleepSeconds);

    let badVerification = await verifyIdentity(username, badPass);

    print("bad password verification failed? (true => correct): ", !badVerification);

    assert(!badVerification);

    sleep(sleepSeconds);

    let account = await retrieveAccount(username, password);

    print("fetched account not null (true => correct): ", account != null);

    assert(account != null);

    assert(account.userKey == username);

    print("get account: ", account);

    sleep(sleepSeconds);

    const accountData = await retrieveAccountData(username, password);

    print("account data is not null (true => correct): ", accountData != null);

    assert(accountData != null);

    print("account data: ", accountData);

    assert(accountData.metaData != null && accountData.metaData['goodAcc']);

    assert(accountData.sensitiveData != null && accountData.sensitiveData['hidden']);

    sleep(sleepSeconds);

    const changeAccountPasswordCheck = await changeAccountPassword(username, password, newPassword);

    print("change account password complete  (true => correct):  ", changeAccountPasswordCheck);

    assert(changeAccountPasswordCheck);

    sleep(sleepSeconds);

    let oldVerification = await verifyIdentity(username, password);

    print("account verification using old password, (false => correct): ", oldVerification);

    assert(!oldVerification);

    sleep(sleepSeconds);

    let newVerification = await verifyIdentity(username, newPassword);

    print("account verification with changed password (true => correct): ", newVerification);

    assert(newVerification);

    const changeAccountUsernameCheck = await changeAccountUsername(username, newUsername, newPassword);

    print("changing account username passed: (true => correct)", changeAccountUsernameCheck);

    assert(changeAccountUsernameCheck);

    sleep(sleepSeconds);

    const newUsernameAccountData = await retrieveAccountData(newUsername, newPassword);

    print("fetched data is not null? (true => correct): ", newUsernameAccountData != null);

    assert(newUsernameAccountData != null &&
           newUsernameAccountData.metaData != null &&
           newUsernameAccountData.sensitiveData != null);

    let sensitiveDataCheck = (accountData.sensitiveData['secretVal'] == newUsernameAccountData.sensitiveData['secretVal']);

    print("sensitiveData preserved during username change (true => correct): ", sensitiveDataCheck);

    assert(sensitiveDataCheck);

    let metaDataCheck = (accountData.metaData['goodAcc'] && newUsernameAccountData.metaData['goodAcc']);

    print("metaData preserved during username change (true => correct): ", metaDataCheck);

    assert(metaDataCheck);

    sleep(sleepSeconds);

    let changeAccMetaDataCallStatus = await changeAccountMetaData(newUsername, newMetaData);

    print("changing account meta data (true => correct): ", changeAccMetaDataCallStatus);

    assert(changeAccMetaDataCallStatus);

    sleep(sleepSeconds);

    const newAccountMetaData = await retrieveAccountMetaData(newUsername);

    print("fetched meta data is not null? (true => correct): ", newAccountMetaData != null);

    assert(newAccountMetaData != null);

    let accountMetaDataChangedCheck = (newUsernameAccountData.metaData['goodAcc'] && newAccountMetaData['goodAccChanged']);

    print("metaData correctly updated (true => correct): ", accountMetaDataChangedCheck);

    assert(accountMetaDataChangedCheck);

    sleep(sleepSeconds);

    const unchangedSensitiveData = await retrieveAccountSensitiveData(newUsername, newPassword);

    print("fetched sensitive data is not null? (true => correct): ", unchangedSensitiveData != null);

    assert(unchangedSensitiveData != null);

    let sensitiveDataNotChangedCheck = (accountData.sensitiveData['secretVal'] == unchangedSensitiveData['secretVal']);

    print("sensitive data not changed after meta data update (true => correct): ", sensitiveDataNotChangedCheck);

    assert(sensitiveDataNotChangedCheck);

    sleep(sleepSeconds);

    const changeAccountSensitiveDataCheck = await changeAccountSensitiveData(newUsername, newPassword, newSensitiveData)

    print("changing account sensitive data: (true => correct): ", changeAccountSensitiveDataCheck);

    assert(changeAccountSensitiveDataCheck);

    sleep(sleepSeconds);

    const newAccountSensitiveData = await retrieveAccountSensitiveData(newUsername, newPassword);

    print("fetched sensitive data is not null? (true => correct): ", newAccountSensitiveData != null);

    assert(newAccountSensitiveData != null);

    let accountSensitiveDataChangedCheck = (newAccountSensitiveData['secretVal'] == newSensitiveData['secretVal']);

    print("sensitiveData correctly updated: (true => correct): ", accountSensitiveDataChangedCheck);

    assert(accountSensitiveDataChangedCheck);

    sleep(sleepSeconds);

    const unchangedMetaData = await retrieveAccountMetaData(newUsername);

    print("fetched meta data is not null? (true => correct): ", unchangedMetaData != null);

    assert(unchangedMetaData != null);

    let metaDataNotChangedCheck = (newAccountMetaData['goodAccChanged'] && unchangedMetaData['goodAccChanged']);

    print("meta data not changed after sensitive data update (true => correct): ", metaDataNotChangedCheck);

    assert(metaDataNotChangedCheck);

    sleep(sleepSeconds);

    const changeAllDataCheck = await changeAccountData(newUsername, newPassword, newMetaData2, newSensitiveData2);

    print("changing account meta and sensitive data: (true => correct)", changeAllDataCheck);

    assert(changeAllDataCheck)

    sleep(sleepSeconds);

    const newNewAccountData = await retrieveAccountData(newUsername, newPassword);

    print("fetched data is not null? (true => correct): ", newNewAccountData != null);

    assert(newNewAccountData != null && newNewAccountData.metaData != null && newNewAccountData.sensitiveData != null);

    let newNewAccountDataChange = (newNewAccountData.metaData['goodAccChanged2'] &&
                                newNewAccountData.sensitiveData['secretVal'] == newSensitiveData2['secretVal']);

    print("Changeing both meta and sensitive tests at the same time succeeded (true => correct): ", newNewAccountDataChange);

    assert(newNewAccountDataChange);

    print("testing finished!!!\n\n");
}

async function runAllTests(){
    // No wait time (real use case).
    await runTests(0);
    // Short wait time between calls.
    // Long enough to test unconfirmed transactions.
    await runTests(9);
    // Average confirmation time,
    await runTests(60);
    // Wait time longer than most confirmations.
    await runTests(120);

}

runAllTests();