import {
  AmmConfigLayout,
  ApiClmmConfigItem
} from '@raydium-io/raydium-sdk';
import {
  AccountInfo,
  PublicKey
} from '@solana/web3.js';

import { private_connection } from '../../config';

export function formatConfigInfo(id: PublicKey, account: AccountInfo<Buffer>): ApiClmmConfigItem {
  const info = AmmConfigLayout.decode(account.data)

  return {
    id: id.toBase58(),
    index: info.index,
    protocolFeeRate: info.protocolFeeRate,
    tradeFeeRate: info.tradeFeeRate,
    tickSpacing: info.tickSpacing,
    fundFeeRate: info.fundFeeRate,
    fundOwner: info.fundOwner.toString(),
    description: '',
  }
}

export async function formatClmmConfigs(programId: string) {
  const configAccountInfo = await private_connection.getProgramAccounts(new PublicKey(programId), { filters: [{ dataSize: AmmConfigLayout.span }] })
  return configAccountInfo.map(i => formatConfigInfo(i.pubkey, i.account)).reduce((a, b) => { a[b.id] = b; return a }, {} as { [id: string]: ApiClmmConfigItem })
}
