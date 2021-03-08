import ChainCache from './libs/ChainCache'
import JupiterClient from './libs/JupiterClient';
import { v1 as uuidv1 } from 'uuid'
import  bcrypt from 'bcrypt'
import sha256 from 'sha256'

// Global variables
// --------------------------------------------------------------------------------------

// Juipiter API Url.
let serverUrl = "https://jpr3.gojupiter.tech";

// An object holding the cached API responses.
// Data has a short life-span.
let jupChainCache = new ChainCache();

// Holds the applications funded & public key enabled
// master Jupiter account identifier.
let jupAccountId = null;
// Holds the master Jupiter account's password.
let jupPassphrase = null;
// Holds the master Jupiter account's public keyp.
let jupPublicKey = null;

const bcryptSaltRounds = 10;

let testAccount = "";

let firstBlockIndex = 0;
let lastBlockIndex = 1000;

// API functions
// --------------------------------------------------------------------------------------

export const setTestAccount = function(_testAccount) {
    testAccount = _testAccount;
}

export const setFirstLastBlockIndex = function(_firstBlockIndex, _lastBlockIndex) {
    firstBlockIndex = _firstBlockIndex;
    lastBlockIndex = _lastBlockIndex;
}

/// @function setJupiterAccountDetails
/// Sets the Jupiter master account info to enable the accounts to be accessed
/// from the blockchain. N.B. The account must be loaded with native JUP.
/// @param {string} jupAccountId_  is your funded Jupiter Account Id.
/// @param {string} jupPassphrase_ is Your Jupiter passphrase to access your account.
/// @param {string} serverUrl_ is the Jupiter API server URL, which can be omitted,
/// unless the URL changes and the default becomes invalid.
/// @returns true if the username is available, false otherwise.
export const setJupiterAccountDetails = function(serverUrl_, jupAccountId_,
                                                 jupPassphrase_, jupPublicKey_) {
    if (serverUrl_ != null)
        serverUrl = serverUrl_;

    jupAccountId = jupAccountId_;
    jupPassphrase = jupPassphrase_;
    jupPublicKey = jupPublicKey_;
}

/// @function checkUsernameAvailability
/// Checks to see if a username has already been taken in a different account.
/// @param {string} userKey is the username field for the account, can be an email address.
/// @returns true if the username is available, false otherwise.
export const checkUsernameAvailability = async function(userKey) {
    if (!isValidEntry(userKey))
        return false;
    return (await retrieveAccount(userKey, null)) == null;
}

/// @function createAccount
/// Creates a new user account for your app on the Jupiter blockchain.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the password for the user account.
/// @param {Object} metaData is any data relating to this account, which can
/// be accessed by this app, without the users password. But is encrypted once
/// on the Jupiter Blockchain. Should be considered less secure than sensitiveData.
/// @param {Object} sensitiveData is any data relating to this account, which will
/// only be accessible with the users password in future.
/// N.B. if the user forgets their password their sensisitveData will be lost.
/// @param {Bool} preCrypted implies the password and sensitiveData fields
/// are being brought in from a previous version of the account. And so
/// should avoid being re-encrypted.
/// @returns true if the account was successfully created, otherwise false.
export const createAccount = async function(userKey, passKey, metaData, sensitiveData,
                                 preCrypted = false) {
    if (!isValidEntry(userKey) || !isValidEntry(passKey))
        return null;

    if ((await checkUsernameAvailability(userKey)) === false)
        return false;

    // The one time we call getJupiterClient with credentials without passing
    // verification, as an account with that username doesn't exist yet.
    let jupClient = await getJupiterClient(userKey, passKey, preCrypted);

    const passHash = preCrypted ?
                     passKey :
                     bcrypt.hashSync(userKey.concat(passKey), bcryptSaltRounds);

    const res = await jupClient.storeCreateUserAccount(uuidv1(), userKey,
                                                       metaData, sensitiveData,
                                                       passHash, preCrypted);

    return res['broadcasted'] == true;
} 

/// @function verifyIdentity
/// Verifies if a users account and password combination are a valid pair.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the current password for the account.
/// @returns true on if the login data is valid, otherwise false.
export const verifyIdentity = async function(userKey, passKey) {
    const accountDecrypted = await retrieveAccount(userKey, passKey);

    if (accountDecrypted == null)
        return false;

    return (
        bcrypt.compareSync(
            userKey.concat(passKey),
            accountDecrypted.encryptedPassKey));
}

/// @function retrieveAccount
/// Retrieves a user account from the Jupiter blockchain.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the password for the user account.
/// @param {string} keepEncryptedSensitiveData passes through the encrypted
/// sensitive data, for the purpose of preservation.
/// @returns the requested account iff the password and username are valid.
/// If the password was null, but the username was valid, then the account will be fetched
/// with the sensitive data field nullified.
/// If the password and/or username were invalid, null will be returned.
export const retrieveAccount = async function(userKey, passKey,
                                              keepEncryptedSensitiveData) {
    return await getAccount(userKey, passKey, keepEncryptedSensitiveData);
}

/// @function retrieveAllAccounts
/// Retrieves all user accounts from the Jupiter blockchain.
/// @returns All user accounts. No sensitve data is decrypted.
export const retrieveAllAccounts = async function() {
    return await getAllAccounts();
}

/// @function retrieveAccountData
/// Retrieves a user account from the Jupiter blockchain.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the password for the user account.
/// @returns the requested account's data in an object {metaData: ..., sensitiveData: ...}
/// on success.
/// If the password was null, but the username was valid, then function will succeed, but
/// the sensitiveData field will be nullified. 
/// If the password and/or username were invalid, null will be returned.
export const retrieveAccountData = async function(userKey, passKey) {
    let account = await retrieveAccount(userKey, passKey);
    if (account != null)
        return {metaData: account.metaData, sensitiveData: account.sensitiveData};
    return null;
}

/// @function retrieveAccountMetaData
/// Retrieves a user accounts meta data from the Jupiter blockchain.
/// Only the username is needed, no password is needed.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @returns the requested account's meta data as an object on success.
/// otherwise null;
export const retrieveAccountMetaData = async function(userKey) {
    let account = await retrieveAccount(userKey, null);
    if (account != null)
        return account.metaData;
    return null;
}

/// @function retrieveAccountSensitiveData
/// Retrieves a user account from the Jupiter blockchain.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the password for the user account.
/// @returns the requested account's sensitive data, decrypted as object on success.
/// If the password was null, but the username was valid, then function will succeed, but
/// the sensitiveData field will be nullified. 
/// If the password and/or username were invalid, null will be returned.
export const retrieveAccountSensitiveData = async function(userKey, passKey) {
    let account = await retrieveAccount(userKey, passKey);
    if (account != null)
        return account.sensitiveData;
    return null;
}

/// @function changeAccountPassword
/// Changes a user account's password on the Jupiter blockchain.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the current password for the account.
/// @param {string} newPassKey is the new password for the account.
/// @returns true on success, otherwise false.
export const changeAccountPassword = async function(userKey, passKey, newPassKey) {
    if (await verifyIdentity(userKey, passKey) === false)
        return false;

    // Since verification was passed, sensitiveData will be decrypted
    // and available, if present.
    const accData = await retrieveAccountData(userKey, passKey);

    if (accData == null)
        return false;
    await removeAccount(userKey, passKey);

    await createAccount(userKey, newPassKey, accData.metaData, accData.sensitiveData);
    return true;
}

/// @function changeAccountUsername
/// Changes a user account's password on the Jupiter blockchain.
/// @param {string} userKey is the current username field for the account,
/// for example an email address.
/// @param {string} newUserKey is the new username field for the account,
/// for example an email address.
/// @param {string} passKey is the current password for the account.
/// @returns true on success, otherwise false.
export const changeAccountUsername = async function(userKey, newUserKey, passKey) {
    if (await verifyIdentity(userKey, passKey) === false)
        return false;
    // Since verification was passed, sensitiveData will be decrypted
    // and available, if present.
    const accData = await retrieveAccountData(userKey, passKey);
    if (accData == null)
        return false;
    await removeAccount(userKey, passKey);
    await createAccount(newUserKey, passKey, accData.metaData, accData.sensitiveData);
    return true;
}

/// @function changeAccountData
/// Changes a user account's data on the Jupiter blockchain.
/// Full verification is needed as it alters the sensitiveData.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the current password for the account.
/// @param {Object} newMetaData is the new meta data for the account.
/// @param {Object} newSensitiveData is the new sensitive data for the account.
/// @returns the newly updated account on success, otherwise null.
export const changeAccountData = async function(userKey, passKey, newMetaData, newSensitiveData) {
    if (await verifyIdentity(userKey, passKey) === false)
        return false;
    await removeAccount(userKey, passKey);
    return await createAccount(userKey, passKey, newMetaData, newSensitiveData);
}

/// @function changeAccountMetaData
/// Changes a user account's meta data on the Jupiter blockchain.
/// As this is a meta data change only, the user password is not needed.
/// The sensitive data will be preserved, but not decrypted.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {Object} newMetaData is the new meta data for the account.
/// @returns the newly updated account on success, otherwise null.
export const changeAccountMetaData = async function(userKey, newMetaData) {
    let account = await retrieveAccount(userKey, null, true);
    if (account == null)
        return false;
    // Force account removal, as preserving sensitive data.
    await removeAccount(userKey, null, true);
    return await createAccount(userKey, account.encryptedPassKey, newMetaData,
                         account.sensitiveData, true);
}

/// @function changeAccountData
/// Changes a user account's data on the Jupiter blockchain.
/// Full verification is needed as it alters the sensitiveData.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the current password for the account.
/// @param {Object} newSensitiveData is the new sensitive data for the account.
/// @returns the newly updated account on success, otherwise null.
export const changeAccountSensitiveData = async function(userKey, passKey, newSensitiveData) {
    if (await verifyIdentity(userKey, passKey) === false)
        return false;
    // Since we are replacing sensitive data, no need for password
    // to decrypt sensitiveData.
    const accData = await retrieveAccountData(userKey, null);
    if (accData == null)
        return false;
    await removeAccount(userKey, passKey);

    return await createAccount(userKey, passKey, accData.metaData, newSensitiveData);
}

/// @function removeAccount
/// Marks the users account as invalid on the Jupiter blockchain.
/// This account won't appear in future account queries with this library.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the current password for the account.
/// @param {bool} force allows an account to be removed without the accounts password.
/// @returns true on success, otherwise false.
export const removeAccount = async function(userKey, passKey, force = false) {
    if (!force && await verifyIdentity(userKey, passKey) === false)
        return false;

    // Since we just want the account id, no need for user password.
    let account = await retrieveAccount(userKey, null);
    let accountId = account.accountId
    let jupClient = await getJupiterClient(null);

    let res =  await jupClient.storeRemoveUserAccount({ accountId: accountId, isDeleted: true });
    return res['broadcasted'] == true;
}


// Helper Methods
// --------------------------------------------------------------------------------------

/// @function isValidEntry
/// Checks a username or password is not null and not the empty string.
/// @param {string} str is the string to be checked.
/// @returns true if str is valid.
const isValidEntry = function(str) {
    return (typeof str === 'string' || str instanceof String) &&
            Boolean(str);
}

/// @function getAccount
/// Fetches the requested user account from the Jupiter Blockchain.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the current password for the account.
/// @param {string} keepEncryptedSensitiveData passes through the encrypted
/// sensitive data, for the purpose of preservation.
/// @returns the requested account iff the password and username are valid.
/// If the password was null, but the username was valid, then the account will be fetched
/// with the sensitive data field nullified.
/// If the password and/or username were invalid, null will be returned.
const getAccount = async function(userKey, passKey, keepEncryptedSensitiveData = false) {
    const cachedAccount = await jupChainCache.fetchUserKeyRecordFromChainCache(userKey);
    let account = null;

    if (cachedAccount == null) {
        const accounts = await getAllAccounts();

        account = await accounts.find((a) => a.userKey === userKey);
        if (account == null)
            return null;
    } else if (cachedAccount['isDeleted']){
        // chainCache reports this account has been deleted.
        return null;
    } else
        account = cachedAccount;

    if (passKey != null) {
        //console.log("account ", account);
        //console.log(userKey.concat(passKey) + " : " + account.encryptedPassKey);
        if (bcrypt.compareSync(userKey.concat(passKey), account.encryptedPassKey)) {
            const jupClient = await getJupiterClient(userKey, passKey);
            // Decrypting the sensitive data.
            account.sensitiveData = account.sensitiveData ? 
                JSON.parse(await jupClient.decrypt(account.sensitiveData)) :
                null;
        } else {
            // Failed password attempt required null return.
            return null;
        }
    } else if (!keepEncryptedSensitiveData) {
        // If keepEncryptedSensitiveData is true, we don't nullify this field.
        account["sensitiveData"] = null;
    }

    account.metaData = account.metaData != null ? JSON.parse(account.metaData) : null;

    return await account;
}

/// @function getAllAccounts
/// Fetches all the accounts from the Jupiter Blockchain for the master jupAccountId.
/// @returns all of the users non-deleted accounts.
const getAllAccounts = async function() {
    const client = await getJupiterClient(null);

    const chainCacheInstance = await jupChainCache.fetchAllRecordsFromChainCache();

    const unconfTxns = await client.getAllUnconfirmedTransactions();
    const txns = await client.getAllTransactions();

    let  allAccounts = null;
    if (unconfTxns.length == 0)
        allAccounts = await combineAccountDicts(await parseTransactions(txns),
                                                chainCacheInstance);
    else
        allAccounts = await combineAccountDicts(
                            await parseTransactions(unconfTxns,
                                                    await parseTransactions(txns)),
                            chainCacheInstance);

    // Testing
    //console.log("unconfTxns len ", unconfTxns.length);
    //console.log("txns len ", txns.length);
    //console.log("allConfAccounts len ", Object.keys(allAccounts).length);

    return Object.values(allAccounts);
}


const parseTransactions = async function(txns, initalRecords) {
    if (txns == null)
        throw new Error("txns cannot be null!");
    
    initalRecords = await initalRecords;

    const client = await getJupiterClient(null);
    const initRecs = initalRecords == null ? {} : initalRecords;

    return (
        await txns.reduce(async (result, txn) => {
            result = await result;
            try {
                const decryptedMessage = await client.decryptRecord(
                    txn.attachment.encryptedMessage
                )
                let account = JSON.parse(decryptedMessage);

                // Testing
                //if (account.userKey == testAccount)
                //    console.log("found " + testAccount + ": ", account);

                if (!account[client.recordKey]) return await result;

                delete account[client.recordKey];

                if (account.isDeleted != null){
                    // Testing
                    //if (account.userKey == testAccount)
                    //    console.log("deleting " + testAccount);
                    delete result[account.accountId];
                    return await result;
                }
                
                // Testing
                //if (account.userKey == testAccount){
                //    console.log("Reduce adding to result: ", testAccount);
                    //console.log("Transaction: ", txn);
                //}
                result[account.accountId] = await account;

                return await result;
            } catch (err) {
                // handle error
            }
            return await result;
            },
            initRecs
        )
    )
}

/// This function overwrites the olderState dictionary witht he newer states
/// information.
const combineAccountDicts = async function(olderState, newerState) {
    for (const acc of Object.values(newerState)){
        if (acc.isDeleted != null)
            delete olderState[acc.accountId];
        else
            olderState[acc.accountId] = acc;
    }
    return olderState;
}

/// @function deleteAllAccounts
/// Deletes all user accounts on the Jupiter Blockchain created under the
/// master Jupiter Account.
/// @returns void
export const deleteAllAccounts = async function() {
    const accounts = await getAllAccounts();
    for (const account of accounts) {
        let jupClient = await getJupiterClient(null);
        await jupClient.storeRemoveUserAccount({ accountId: account.accountId,
                                                 isDeleted: true });
    }
}

/// @function getJupiterClient
/// Fetches a Jupiter Client instance and saves it to the global variable
/// jupClient, specifically initialised with the passkey for a specific users data.
/// N.B. All data is also encrypted with the master accounts encryption
/// keys in addition.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the password for the user account.
/// @param {Bool} preCrypted implies the password and sensitiveData fields
/// are being brought in from a previous version of the account. And so
/// should avoid being re-encrypted.
/// @returns void
const getJupiterClient = async function(userKey, passKey, preCrypted) {
    if (jupAccountId == null)
        throw new Error("Cannot get Jupiter Client without account Id.");

    // Sometimes we just want generoc blockcahin read access without targeting
    // a specific user account
    if (userKey == null)
        return JupiterClient({
            server: serverUrl,
            address: jupAccountId,
            passphrase: jupPassphrase,
            publicKey: jupPublicKey,
            encryptSecret: null,
            firstIndex: firstBlockIndex,
            lastIndex: lastBlockIndex},
            jupChainCache
        );

    if (!isValidEntry(passKey))
        throw new Error("A valid password is required to get Jupiter Client " +
                        "for a particular username and account.");

    if (!isValidEntry(userKey))
        throw new Error("A valid username is required to get Jupiter Client " +
            "for a particular username and account.");

    let passHash = preCrypted ?
                   passKey :
                   sha256(userKey.concat(passKey));

    let jupClient =  JupiterClient({
        server: serverUrl,
        address: jupAccountId,
        passphrase: jupPassphrase,
        publicKey: jupPublicKey,
        encryptSecret: passHash,
        firstIndex: firstBlockIndex,
        lastIndex: lastBlockIndex},
        jupChainCache
    );

    // Fetch public key if not provided. Should only need to be fetched
    // once per application lifetime.
    if (!jupPublicKey) {
        jupPublicKey = await jupClient.getAccountPublicKey();

        jupClient = JupiterClient({
            server: serverUrl,
            address: jupAccountId,
            passphrase: jupPassphrase,
            publicKey: jupPublicKey,
            encryptSecret: passHash,
            firstIndex: firstBlockIndex,
            lastIndex: lastBlockIndex},
            jupChainCache
        );
    }

    return jupClient;
}