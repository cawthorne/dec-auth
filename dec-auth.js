import JupiterClient from './libs/JupiterClient.js';
import { v1 as uuidv1 } from 'uuid'


// Global variables
// --------------------------------------------------------------------------------------

// Juipiter API Url.
let serverUrl = "https://jpr.gojupiter.tech";

// Holds the applications funded & public key enabled
// master Jupiter account identifier.
let jupAccountId = null;
// Holds the master Jupiter account's password.
let jupPassphrase = null;
// Holds the master Jupiter account's public keyp.
let jupPublicKey = null;

// Global jupClient TODO: reuse this global client more efficiently.
let jupClient = null;



// API functions
// --------------------------------------------------------------------------------------

/// @function getJupiterClient
/// Fetches a Jupiter Client instance and saves it to the global variable
/// jupClient, specifically initialised with the passkey for a specific users data.
/// N.B. All data is also encrypted with the master accounts encryption
/// keys in addition.
/// @param {string} passKey is the password for a user account.
/// @returns void
const getJupiterClient = async function(passKey){

    jupClient = JupiterClient({
        server: serverUrl,
        address: jupAccountId,
        passphrase: jupPassphrase,
        publicKey: jupPublicKey,
        encryptSecret: passKey,    
    });

    // Fetch public key if not provided. Should only need to be fetched
    // once per lifetime.
    if (!Boolean(jupPublicKey)){
        jupPublicKey = await jupClient.getAccountPublicKey();

        jupClient = JupiterClient({
            server: serverUrl,
            address: jupAccountId,
            passphrase: jupPassphrase,
            publicKey: jupPublicKey,
            encryptSecret: passKey,    
        });
    }

    return jupClient;
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
/// @param {Object} metaData is any data relating to this account, but can
/// be accessed readily by this app, without the users password.
/// @param {Object} sensitiveData is any data relating to this account, which will
/// only be accessible with the users password in future.
/// N.B. if the user forgets their password their sensisitveData will be lost.
/// @param {Bool} preCrypted implies the password and sensitiveData fields
/// are being brought in from a previous version of the account. And so
/// should avoid encryption again.
/// @returns true if the account was successfully created, otherwise false.
export const createAccount = async function(userKey, passKey, metaData, sensitiveData,
                                 preCrypted = false) {
    if (!isValidEntry(userKey) || !isValidEntry(passKey))
        return null;

    if (await checkUsernameAvailability(userKey) === false)
        return false;

    let jupClient = await getJupiterClient(userKey.concat(passKey));

    let res = await jupClient.storeUserAccount(uuidv1(), userKey,
                                               metaData, sensitiveData,
                                               passKey, preCrypted);

    return res['broadcasted'] == true;
}

/// @function retrieveAccount
/// Retrieves a user account from the Jupiter blockchain.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the password for the user account.
/// @returns the requested account iff the password and username are valid.
/// If the password was null, but the username was valid, then the account will be fetched
/// with the sensitive data field nullified.
/// If the password and/or username were invalid, null will be returned.
export const retrieveAccount = async function(userKey, passKey) {
    let acc = await getAccount(userKey, passKey);
    return acc;
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

/// @function changeAccountPassword
/// Changes a user account's password on the Jupiter blockchain.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the current password for the account.
/// @param {string} newPassKey is the new password for the account.
/// @returns true on success, otherwise false.
export const changeAccountPassword = async function(userKey, passKey, newPassKey) {
    if (verifyIdentity(userKey, passKey) === false)
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
    if (verifyIdentity(userKey, passKey) === false)
        return false;
    // Since verification was passed, sensitiveData will be decrypted
    // and available, if present.
    const accData = retrieveAccountData(userKey, passKey);
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
    await removeAccount(userKey, null, force);
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
    let accountId = account.id;
    let jupClient = await getJupiterClient(userKey.concat(passKey));
    await jupClient.storeRecord({ accountId: accountId, isDeleted: true });
    return true;
}

/// @function verifyIdentity
/// Verifies if a users account and password combination are a valid pair.
/// @param {string} userKey is the username field for the account,
/// for example an email address.
/// @param {string} passKey is the current password for the account.
/// @returns true on if the login data is valid, otherwise false.
export const verifyIdentity = async function(userKey, passKey) {
    // Retrieve account without any decryption.
    let account = await retrieveAccount(userKey, null);
    if (account == null)
        return false;

    let jupClient = await getJupiterClient(userKey.concat(passKey));
    let encryptedPassKeyTest = jupClient.encrypt(passKey);
    return await retrieveAccount(userKey, passKey).encryptedPassKey === encryptedPassKeyTest;
}

// Helper Methods
// --------------------------------------------------------------------------------------

/// @function isValidEntry
/// Checks a username or password is not null and not the empty string.
/// @param {string} str is the string to be checked.
/// @returns true if str is valid.
const isValidEntry = function(str){
    return (typeof str === 'string' || str instanceof String) &&
            Boolean(str);
}

/// @function getAllAccounts
/// Fetches all the accounts from the Jupiter Blockchain for the master jupAccountId.
/// @returns all of the users non-deleted accounts.
const getAllAccounts = async function() {
    const client = await getJupiterClient(null);
    const txns = await client.getAllTransactions();

    const allRecords = (
      await Promise.all(
        txns.map(async (txn) => {
          try {
            const decryptedMessage = await client.decryptRecord(
              txn.attachment.encryptedMessage
            )
            let account = JSON.parse(decryptedMessage);

            if (!account[client.recordKey]) return false

            delete account[client.recordKey]
            return account
          } catch (err) {
            return { error: err }
          }
        })
      )
    )
    .filter((r) => r)
    .reduce(
    (result , account) => ({
        ...result,
        [account.accountId]: { ...result[account.accountId], ...account },
    }),
    {}
    )

    return Object.values(allRecords).filter((r) => !r.isDeleted)
}

/// @function getAccount
/// Fetches the requested account from the Jupiter Blockchain.
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
    const accounts = await getAllAccounts();
    let account = accounts.find((a) => a.userKey === userKey);
    if (account == null)
        return null;

    let jupClient = await getJupiterClient(userKey.concat(passKey));
    if (passKey != null){
        if (account.encryptedPassKey === await jupClient.encrypt(passKey)){
            account.sensitiveData = account.sensitiveData ? 
                JSON.parse(await client.decrypt(account.sensitiveData)) :
                null;
        } else {
            // Failed password attempt required null return.
            return null;
        }
    } else if (!keepEncryptedSensitiveData){
        // If keepEncryptedSensitiveData is true, we don't nullify this field.
        account["sensitiveData"] = null;
    }

    return account
}