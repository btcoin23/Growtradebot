import {
  ApiClmmConfigItem,
  ApiClmmPoolsItem,
  PoolInfoLayout
} from '@raydium-io/raydium-sdk';
import {
  PublicKey
} from '@solana/web3.js';

import { private_connection } from '../../config';
import { formatConfigInfo } from './formatClmmConfigs';
import { getApiClmmPoolsItemStatisticsDefault } from './formatClmmKeys';

async function getMintProgram(mint: PublicKey) {
  const account = await private_connection.getAccountInfo(mint)
  if (account === null) throw Error(' get id info error ')
  return account.owner
}
async function getConfigInfo(configId: PublicKey): Promise<ApiClmmConfigItem> {
  const account = await private_connection.getAccountInfo(configId)
  if (account === null) throw Error(' get id info error ')
  return formatConfigInfo(configId, account)
}

export async function formatClmmKeysById(id: string): Promise<ApiClmmPoolsItem> {
  const account = await private_connection.getAccountInfo(new PublicKey(id))
  if (account === null) throw Error(' get id info error ')
  const info = PoolInfoLayout.decode(account.data)

  return {
    id,
    mintProgramIdA: (await getMintProgram(info.mintA)).toString(),
    mintProgramIdB: (await getMintProgram(info.mintB)).toString(),
    mintA: info.mintA.toString(),
    mintB: info.mintB.toString(),
    vaultA: info.vaultA.toString(),
    vaultB: info.vaultB.toString(),
    mintDecimalsA: info.mintDecimalsA,
    mintDecimalsB: info.mintDecimalsB,
    ammConfig: await getConfigInfo(info.ammConfig),
    rewardInfos: await Promise.all(
      info.rewardInfos
        .filter((i) => !i.tokenMint.equals(PublicKey.default))
        .map(async (i) => ({
          mint: i.tokenMint.toString(),
          programId: (await getMintProgram(i.tokenMint)).toString(),
        }))
    ),
    tvl: 0,
    day: getApiClmmPoolsItemStatisticsDefault(),
    week: getApiClmmPoolsItemStatisticsDefault(),
    month: getApiClmmPoolsItemStatisticsDefault(),
    lookupTableAccount: PublicKey.default.toBase58(),
  }
}
