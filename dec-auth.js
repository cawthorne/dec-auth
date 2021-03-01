import JupiterClient from './libs/JupiterClient.ts';
import { v1 as uuidv1 } from 'uuid'

// Juipiter API Url
let serverUrl = "https://jpr.gojupiter.tech";

// Holds the applications funded master Jupiter account identifier
let jupAccountId = "";
// Holds the master Jupiter account's password
let jupPassphrase = "";


/// @function getJupiterClient
/// Fetches a Jupiter Client instance, specifically initialised with the
/// passkey for a specific users data.
/// N.B. All data is also encrypted with the master jupPassphrase as well.
/// @param {string} passKey is the password for a user account.
/// @returns the Jupiter Client instance (which has useful helper methods).
const getJupiterClient = function(passKey){
    return JupiterClient({
        server: serverUrl,
        address: jupAccountId,
        passphrase: jupPassphrase,
        encryptSecret: passKey,    
    });
}

/// @function setJupiterAccountDetails
/// Sets the Jupiter master account info to enable the accounts to be accessed
/// from the blockchain. N.B. The account must be loaded with native JUP.
/// @param {string} jupAccountId_  is your funded Jupiter Account Id.
/// @param {string} jupPassphrase_ is Your Jupiter passphrase to access your account.
/// @param {string} serverUrl_ is the Jupiter API server URL, which can be omitted,
/// unless the URL changes and the default becomes invalid.
/// @returns true if the username is available, false otherwise.
exports.setJupiterAccountDetails = function(jupAccountId_, jupPassphrase_, serverUrl_) {
    jupAccountId = jupAccountId_;
    jupPassphrase = jupPassphrase_;
    if (serverUrl_ !== null)
        serverUrl = serverUrl_;
}

/// @function checkUsernameAvailability
/// Checks to see if a username has already been taken in a different account.
/// @param {string} userKey is the username field for the account, can be an email address.
/// @returns true if the username is available, false otherwise.
exports.checkUsernameAvailability = function(userKey) {
    if (!isValidEntry(userKey))
        return false;

    return retrieveAccount(userKey, null) === null;
}

/// @function createAccount
/// Creates a new user account for your app on the Jupiter blockchain.
/// @param {string} userKey is the username field for the account, can be an email address.
/// @param {string} passKey is the password for the user account.
/// @param {Object} metaData is any data relating to this account, but can
/// be accessed readily by this app, without the users password.
/// @param {Object} sensitiveData is any data relating to this account, which will
/// only be accessible with the users password in future.
/// N.B. if the user forgets their password their sensisitveData will be lost.
/// @param {Bool} preCrypted implies the password and sensitiveData fields
/// are being brought in from a previous version of the account. And so
/// should avoid encryption again.
/// @returns the newly created account on success, otherwise null.
exports.createAccount = function(userKey, passKey, metaData, sensitiveData,
                                 preCrypted = false) {
    if (!isValidEntry(userKey) || !isValidEntry(passKey))
        return null;

    if (checkUsernameAvailability(userKey) === false)
        return false;

    let jupClient = getJupiterClient(userKey.conact(passKey));
    return jupClient.storeRecord({accountId: uuidv1(),
                                 userKey: userKey,
                                 metaData: metaData},
                                 sensitiveData, passKey, preCrypted);
}

/// @function retrieveAccount
/// Retrieves a user account from the Jupiter blockchain.
/// @param {string} userKey is the username field for the account, can be an email address.
/// @param {string} passKey is the password for the user account.
/// @returns the requested account iff the password and username are valid.
/// If the password was null, but the username was valid, then the account will be fetched
/// with the sensitive data field nullified.
/// If the password and/or username were invalid, null will be returned.
exports.retrieveAccount = function(userKey, passKey) {
    return getAccount(userKey, passKey);
}

/// @function retrieveAccountData
/// Retrieves a user account from the Jupiter blockchain.
/// @param {string} userKey is the username field for the account, can be an email address.
/// @param {string} passKey is the password for the user account.
/// @returns the requested account's data in an object {metaData: ..., sensitiveData: ...}
/// on success.
/// If the password was null, but the username was valid, then function will succeed, but
/// the sensitiveData field will be nullified. 
/// If the password and/or username were invalid, null will be returned.
exports.retrieveAccountData = function(userKey, passKey) {
    let account = retrieveAccount(userKey, passKey);
    if (account != null)
        return {metaData: account.metaData, sensitiveData: account.sensitiveData};
    return null;
}

/// @function changeAccountPassword
/// Changes a user account's password on the Jupiter blockchain.
/// @param {string} userKey is the username field for the account, can be an email address.
/// @param {string} passKey is the current password for the account.
/// @param {string} newPassKey is the new password for the account.
/// @returns true on success, otherwise false.
exports.changeAccountPassword = function(userKey, passKey, newPassKey) {
    if (verifyIdentity(userKey, passKey) === false)
        return false;
    // Since verification was passed, sensitiveData will be decrypted
    // and available, if present.
    const accData = retrieveAccountData(userKey, passKey);
    if (accData === null)
        return false;
    removeAccount(userKey, passKey);
    createAccount(userKey, newPassKey, accData.metaData, accData.sensitiveData);
    return true;
}

/// @function changeAccountUsername
/// Changes a user account's password on the Jupiter blockchain.
/// @param {string} userKey is the username field for the account, can be an email address.
/// @param {string} passKey is the current password for the account.
/// @param {string} newPassKey is the new password for the account.
/// @returns true on success, otherwise false.
exports.changeAccountUsername = function(userKey, newUserKey, passKey) {
    if (verifyIdentity(userKey, passKey) === false)
        return false;
    // Since verification was passed, sensitiveData will be decrypted
    // and available, if present.
    const accData = retrieveAccountData(userKey, passKey);
    if (accData === null)
        return false;
    removeAccount(userKey, passKey);
    createAccount(newUserKey, passKey, accData.metaData, accData.sensitiveData);
    return true;
}

/// @function changeAccountData
/// Changes a user account's data on the Jupiter blockchain.
/// Full verification is needed as it alters the sensitiveData.
/// @param {string} userKey is the username field for the account, can be an email address.
/// @param {string} passKey is the current password for the account.
/// @param {Object} newMetaData is the new meta data for the account.
/// @param {Object} newSensitiveData is the new sensitive data for the account.
/// @returns the newly updated account on success, otherwise null.
exports.changeAccountData = function(userKey, passKey, newMetaData, newSensitiveData) {
    if (verifyIdentity(userKey, passKey) === false)
        return false;
    removeAccount(userKey, passKey);
    return createAccount(userKey, passKey, newMetaData, newSensitiveData);
}

/// @function changeAccountMetaData
/// Changes a user account's meta data on the Jupiter blockchain.
/// As this is a meta data change only, the user password is not needed.
/// The sensitive data will be preserved, but not decrypted.
/// @param {string} userKey is the username field for the account, can be an email address.
/// @param {Object} newMetaData is the new meta data for the account.
/// @returns the newly updated account on success, otherwise null.
exports.changeAccountMetaData = function(userKey, newMetaData) {
    let account = retrieveAccount(userKey, null, true);
    if (account === null)
        return false;
    removeAccount(userKey, null, force);
    return createAccount(userKey, account.encryptedPassKey, newMetaData,
                         account.sensitiveData, true);
}

/// @function changeAccountData
/// Changes a user account's data on the Jupiter blockchain.
/// Full verification is needed as it alters the sensitiveData.
/// @param {string} userKey is the username field for the account, can be an email address.
/// @param {string} passKey is the current password for the account.
/// @param {Object} newSensitiveData is the new sensitive data for the account.
/// @returns the newly updated account on success, otherwise null.
exports.changeAccountSensitiveData = function(userKey, passKey, newSensitiveData) {
    if (verifyIdentity(userKey, passKey) === false)
        return false;
    // Since we are replacing sensitive data, no need for password
    // to decrypt sensitiveData.
    const accData = retrieveAccountData(userKey, null);
    if (accData === null)
        return false;
    removeAccount(userKey, passKey);
    return createAccount(userKey, passKey, accData.metaData, newSensitiveData);
}

/// @function removeAccount
/// Marks the users account as invalid on the Jupiter blockchain.
/// This account won't appear in future account queries with this library.
/// @param {string} userKey is the username field for the account, can be an email address.
/// @param {string} passKey is the current password for the account.
/// @param {bool} force allows an account to be removed without the accounts password.
/// @returns true on success, otherwise false.
exports.removeAccount = function(userKey, passKey, force = false) {
    if (!force && verifyIdentity(userKey, passKey) === false)
        return false;

    // Since we just want the account id, no need for user password.
    let account = retrieveAccount(userKey, null);
    let accountId = account.id;
    let jupClient = getJupiterClient(userKey.conact(passKey));
    jupClient.storeRecord({ accountId: accountId, isDeleted: true });
    return true;
}

/// @function verifyIdentity
/// Verifies if a users account and password combination are a valid pair.
/// @param {string} userKey is the username field for the account, can be an email address.
/// @param {string} passKey is the current password for the account.
/// @returns true on if the login data is valid, otherwise false.
exports.verifyIdentity = function(userKey, passKey) {
    // Retrieve account without any decryption.
    let account = retrieveAccount(userKey, null);
    if (account === null)
        return false;

    let jupClient = getJupiterClient(userKey.conact(passKey));
    let encryptedPassKeyTest = jupClient.encrypt(passKey);
    return retrieveAccount(userKey, passKey).encryptedPassKey === encryptedPassKeyTest;
}

// Helper Methods

// --------------------------------------------------------------------------------------

/// @function isValidEntry
/// Checks a username or password is not null and not the empty string.
/// @param {string} str is the string to be checked.
/// @returns true if str is valid.
const isValidEntry = function(str){
    return (typeof myVar === 'string' || myVar instanceof String) &&
            str !== null && str !== "";
}

/// @function getAllAccounts
/// Fetches all the accounts from the Jupiter Blockchain for the master jupAccountId.
/// @returns all of the users non-deleted accounts.
const getAllAccounts = function() {
    const client = getFndrJupiterClient(null);
    const txns = client.getAllTransactions()

    const allRecords = (
      Promise.all(
        txns.map(async (txn) => {
          try {
            const decryptedMessage = client.decryptRecord(
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
/// @param {string} userKey is the username field for the account, can be an email address.
/// @param {string} passKey is the current password for the account.
/// @param {string} keepEncryptedSensitiveData passes through the encrypted
/// sensitive data, for the purpose of preservation.
/// @returns the requested account iff the password and username are valid.
/// If the password was null, but the username was valid, then the account will be fetched
/// with the sensitive data field nullified.
/// If the password and/or username were invalid, null will be returned.
const getAccount = function(userKey, passKey, keepEncryptedSensitiveData = false) {
    const accounts = getAllAccounts();
    let account = accounts.find((a) => a.userKey === userKey);
    if (account === null)
        return null;

    let jupClient = getJupiterClient(userKey.conact(passKey));
    if (passKey !== null){
        if (account.encryptedPassKey === jupClient.encrypt(passKey)){
            account.sensitiveData = account.sensitiveData ? 
                JSON.parse(client.decrypt(account.sensitiveData)) :
                null;
        } else {
            // Failed password attempt required null return.
            return null;
        }
    } else if (!keepEncryptedSensitiveData){
        // If keepEncryptedSensitiveData is true, we don't nullify this field.
        account.sensitiveData = null;
    }

    return account
}