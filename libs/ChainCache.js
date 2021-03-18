// X seconds until cache expires.
// (should be as short as possible really).
const cacheLifetime = 10*1000; // Timer is in milli-seconds.
let chainCache = {};
let userKeyDict = {};
let timersDict = {};

const deepCopy = function(cc) {
    if (cc == null)
        return null;
    return JSON.parse(JSON.stringify(cc));
}

export default class ChainCache {
    constructor() {}

    addRecordToChainCache = async function(record){
        //console.log("CC add account ID ", record.accountId);
        //console.log("CC add userKey ", record.userKey);

        clearTimeout((record.accountId in timersDict) ?
                        timersDict[record.accountId] :
                        null);
    
        const timeOut = setTimeout(() => {
            delete chainCache[record.accountId];
            delete userKeyDict[record.userKey];
            delete timersDict[record.accountId]},
            cacheLifetime);

        chainCache[record.accountId] = record;
        userKeyDict[record.userKey] = record.accountId;
        timersDict[record.accountId] = timeOut;
    }

    fetchAllRecordsFromChainCache = async function(){
        return deepCopy(chainCache);
    }

    fetchRecordFromChainCache = async function(accountId){
        return deepCopy(chainCache[accountId]);
    }

    fetchUserKeyRecordFromChainCache = async function(userKey){
        const accountId = userKeyDict[userKey];
        return accountId != null ? deepCopy(chainCache[accountId]) : null;
    }

    removeRecordFromChainCache = async function(accountId, userKey){

        clearTimeout((accountId in timersDict) ?
                        timersDict[accountId] :
                        null);

        const timeOut = setTimeout(() => {
            const tmpAccount = chainCache[accountId];
            delete userKeyDict[tmpAccount.userKey];
            delete timersDict[accountId];
            delete chainCache[accountId]},
            cacheLifetime);

        delete chainCache[userKeyDict[userKey]];
        delete chainCache[accountId];

        userKeyDict[userKey] = accountId;
        chainCache[accountId] = {accountId: accountId, userKey: userKey,
                                 isDeleted: true};
        timersDict[accountId] = timeOut;
    }

    removeUserKeyRecordFromChainCache = async function(userKey){
        removeRecordFromChainCache(userKeyDict[userKey]);
    }
}