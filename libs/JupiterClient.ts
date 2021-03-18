import axios, { AxiosResponse } from 'axios'
import BigNumber from 'bignumber.js'
import Encryption from '../libs/Encryption'

export default function JupiterClient(opts: IJupiterClientOpts, chainCache: any) {
  if (!(Boolean(opts.server) && Boolean(opts.address) &&
      Boolean(opts.passphrase)))
    throw new Error("You must properly initialise the Jupiter Client");

  const encryption = Encryption({ secret: opts.encryptSecret });
  const CONF = {
    feeNQT: 150,
    deadline: 60,
    minimumTableBalance: 50000,
    minimumAppBalance: 100000,
    moneyDecimals: 8,
  };

  // balances from the API come back as NQT, which is 1e-8 JUP
  const nqtToJup = (nqt: string): string =>
    new BigNumber(nqt).div(CONF.moneyDecimals).toString();

  return {
    recordKey: '__jupiter-connector',

    client: axios.create({
      baseURL: opts.server,
      headers: {
        'User-Agent': 'jupiter-connector',
      },
    }),

    decrypt: encryption.decrypt.bind(encryption),
    encrypt: encryption.encrypt.bind(encryption),

    async loadDatabase() {
      const transactions = await this.getAllTransactions();
    },

    async getBalance(address: string = opts.address): Promise<string> {
      const {
        data: {
          // unconfirmedBalanceNQT,
          // forgedBalanceNQT,
          balanceNQT,
          // requestProcessingTime
        },
      } = await this.request('get', '/nxt', {
        params: {
          requestType: 'getBalance',
          account: address,
        },
      })
      return nqtToJup(balanceNQT)
    },

    async createNewAddress(passphrase: string) {
      const {
        data: { accountRS: address, publicKey, requestProcessingTime, account },
      } = await this.request('post', '/nxt', {
        params: {
          requestType: 'getAccountId',
          secretPhrase: passphrase,
        },
      })
      return { address, publicKey, requestProcessingTime, account }
    },

    async getAccountPublicKey() {
      const {
        data: { publicKey: pubKey, requestProcessingTime },
      } = await this.request('get', '/nxt', {
        params: {
          requestType: 'getAccountPublicKey',
          account: opts.address,
        },
      })
      return pubKey 
    },

    async sendMoney(recipientAddr: string) {
      const { data } = await this.request('post', '/nxt', {
        params: {
          requestType: 'sendMoney',
          secretPhrase: opts.passphrase,
          recipient: recipientAddr,
          amountNQT: CONF.minimumTableBalance,
          feeNQT: CONF.feeNQT,
          deadline: CONF.deadline,
        },
      })
      if (
        data.signatureHash === null ||
        (data.errorCode && data.errorCode !== 0)
      ) {
        throw new Error(JSON.stringify(data))
      }
      return data
    },

    async parseEncryptedRecord(cipherText: string): Promise<any> {
      return JSON.parse(await this.decrypt(cipherText))
    },

    async storeCreateUserAccount(accountId: string, userKey: string, metaData: any,
                           sensitiveData: any, passKey: string,
                           preCrypted: boolean) {
      const messageToEncrypt = {
        accountId: accountId,
        userKey: userKey,
        metaData: JSON.stringify(metaData),
        encryptedPassKey: !passKey ?
          null :
            passKey,
        sensitiveData: !sensitiveData ?
          null :
          (!preCrypted ?
            (await this.encrypt(
            JSON.stringify(sensitiveData))) :
            sensitiveData),
        [this.recordKey]: true
      };

      const { data } = await this.request('post', '/nxt', {
        params: {
          requestType: 'sendMessage',
          secretPhrase: opts.passphrase,
          recipient: opts.address,
          recipientPublicKey: opts.publicKey,
          messageToEncrypt: JSON.stringify(messageToEncrypt),
          feeNQT: CONF.feeNQT,
          deadline: CONF.deadline,
          compressMessageToEncrypt: true,
        },
      })
    
      if (data.errorCode && data.errorCode !== 0) throw new Error(data);

      chainCache.addRecordToChainCache(messageToEncrypt);

      //console.log("new user: ", messageToEncrypt);

      return data
    },

    async storeRemoveUserAccount(record: any) {
      const { data } = await this.request('post', '/nxt', {
        params: {
          requestType: 'sendMessage',
          secretPhrase: opts.passphrase,
          recipient: opts.address,
          recipientPublicKey: opts.publicKey,
          messageToEncrypt:
            JSON.stringify({
              ...record,
              [this.recordKey]: true,
            }),
          feeNQT: CONF.feeNQT,
          deadline: CONF.deadline,
          compressMessageToEncrypt: true,
        },
      })

      if (data.errorCode && data.errorCode !== 0) throw new Error(data)

      //console.log("storeRemoveUserAccount rec ", record);
      chainCache.removeRecordFromChainCache(record.accountId, record.userKey);

      return data
    },

    async storeRecord(record: any) {
      const { data } = await this.request('post', '/nxt', {
        params: {
          requestType: 'sendMessage',
          secretPhrase: opts.passphrase,
          recipient: opts.address,
          recipientPublicKey: opts.publicKey,
          messageToEncrypt: await this.encrypt(
            JSON.stringify({
              ...record,
              [this.recordKey]: true,
            })
          ),
          feeNQT: CONF.feeNQT,
          deadline: CONF.deadline,
          compressMessageToEncrypt: true,
        },
      })
  
      if (data.errorCode && data.errorCode !== 0) throw new Error(data)
      return data
    },

    async decryptRecord(
      message: ITransactionAttachmentDecryptedMessage
    ): Promise<string> {
      const {
        data: { decryptedMessage },
      } = await this.request('get', '/nxt', {
        params: {
          requestType: 'decryptFrom',
          secretPhrase: opts.passphrase,
          account: opts.address,
          data: message.data,
          nonce: message.nonce,
        },
      })
      return decryptedMessage
    },

    async getAllUnconfirmedTransactions(
      withMessage: boolean = true,
      type: number = 1
    ): Promise<ITransaction[]> {
      const {
        data: {
          /* requestProcessingTime, */
          unconfirmedTransactions,
        },
      } = await this.request('post', '/nxt', {
        params: {
          requestType: 'getUnconfirmedTransactions',
          account: opts.address,
          withMessage,
          type,
        },
      })
      
      return unconfirmedTransactions == null ?
        [] :
        unconfirmedTransactions.reverse();
    },

    async getAllTransactions(
      withMessage: boolean = true,
      type: number = 1
    ): Promise<ITransaction[]> {
      const {
        data: {
          /* requestProcessingTime, */
          transactions,
        },
      } = await this.request('get', '/nxt', {
        params: {
          requestType: 'getBlockchainTransactions',
          account: opts.address,
          firstIndex: opts.firstIndex,
          lastIndex: opts.lastIndex,
          withMessage,
          type,
        },
      })
      return transactions == null ?
        [] :
        transactions.reverse();
    },

    async request(
      verb: 'get' | 'post',
      path: string,
      opts?: IRequestOpts
    ): Promise<AxiosResponse> {
      switch (verb) {
        case 'post':
          return await this.client.post(
            path,
            undefined, // opts && opts.body
            {
              params: opts && opts.params,
            }
          )

        default:
          // get
          return await this.client.get(path, opts)
      }
    },
  }
}

interface IJupiterClientOpts {
  server: string
  address: string
  passphrase: string
  encryptSecret: string
  firstIndex: number
  lastIndex: number
  publicKey?: string
  feeNQT?: number
  deadline?: number
  minimumTableBalance?: number
  minimumAppBalance?: number
  moneyDecimals?: number
}

interface IRequestOpts {
  // TODO: according to the NXT docs the only way to pass parameters is
  // via query string params, even if it's a POST. This seems bad, but for
  // now since POST body isn't support don't allow it in a request.
  params?: any
  // body?: any
}

interface ITransactionAttachment {
  [key: string]: any
}

interface ITransactionAttachmentDecryptedMessage {
  data: string
  nonce: string
  isText: boolean
  isCompressed: boolean
}

interface ITransaction {
  signature: string
  transactionIndex: number
  type: number
  phased: boolean
  ecBlockId: string
  signatureHash: string
  attachment: ITransactionAttachment
  senderRS: string
  subtype: number
  amountNQT: string
  recipientRS: string
  block: string
  blockTimestamp: number
  deadline: number
  timestamp: number
  height: number
  senderPublicKey: string
  feeNQT: string
  confirmations: number
  fullHash: string
  version: number
  sender: string
  recipient: string
  ecBlockHeight: number
  transaction: string
}
