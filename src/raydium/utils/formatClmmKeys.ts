import {
  ApiClmmPoolsItem,
  ApiClmmPoolsItemStatistics,
  PoolInfoLayout,
  getMultipleAccountsInfoWithCustomFlags
} from '@raydium-io/raydium-sdk';
import {
  AddressLookupTableAccount,
  PublicKey
} from '@solana/web3.js';

import { private_connection } from '../../config';
import { formatClmmConfigs } from './formatClmmConfigs';

export function getApiClmmPoolsItemStatisticsDefault(): ApiClmmPoolsItemStatistics {
  return {
    volume: 0,
    volumeFee: 0,
    feeA: 0,
    feeB: 0,
    feeApr: 0,
    rewardApr: { A: 0, B: 0, C: 0 },
    apr: 0,
    priceMin: 0,
    priceMax: 0,
  }
}

export async function formatClmmKeys(
  programId: string,
  findLookupTableAddress: boolean = false
): Promise<ApiClmmPoolsItem[]> {
  const filterDefKey = PublicKey.default.toString();

  const poolAccountInfo = await private_connection.getProgramAccounts(
    new PublicKey(programId),
    { filters: [{ dataSize: PoolInfoLayout.span }] }
  );

  const configIdToData = await formatClmmConfigs(programId);

  const poolAccountFormat = poolAccountInfo.map((i) => ({
    id: i.pubkey,
    ...PoolInfoLayout.decode(i.account.data),
  }));

  const allMint = Array.from(
    new Set<string>(
      poolAccountFormat
        .map((i) => [
          i.mintA.toString(),
          i.mintB.toString(),
          ...i.rewardInfos.map((ii) => ii.tokenMint.toString()),
        ])
        .flat()
    )
  )
    .filter((i) => i !== filterDefKey)
    .map((i) => ({ pubkey: new PublicKey(i) }));
  const mintAccount = await getMultipleAccountsInfoWithCustomFlags(
    private_connection,
    allMint
  );
  const mintInfoDict = mintAccount
    .filter((i) => i.accountInfo !== null)
    .reduce((a, b) => {
      a[b.pubkey.toString()] = { programId: b.accountInfo!.owner.toString() };
      return a;
    }, {} as { [mint: string]: { programId: string } });

  const poolInfoDict = poolAccountFormat
    .map((i) => {
      const mintProgramIdA = mintInfoDict[i.mintA.toString()].programId;
      const mintProgramIdB = mintInfoDict[i.mintB.toString()].programId;
      const rewardInfos = i.rewardInfos
        .filter((i) => !i.tokenMint.equals(PublicKey.default))
        .map((i) => ({
          mint: i.tokenMint.toString(),
          programId: mintInfoDict[i.tokenMint.toString()].programId,
        }));

      return {
        id: i.id.toString(),
        mintProgramIdA,
        mintProgramIdB,
        mintA: i.mintA.toString(),
        mintB: i.mintB.toString(),
        vaultA: i.vaultA.toString(),
        vaultB: i.vaultB.toString(),
        mintDecimalsA: i.mintDecimalsA,
        mintDecimalsB: i.mintDecimalsB,
        ammConfig: configIdToData[i.ammConfig.toString()],
        rewardInfos,
        tvl: 0,
        day: getApiClmmPoolsItemStatisticsDefault(),
        week: getApiClmmPoolsItemStatisticsDefault(),
        month: getApiClmmPoolsItemStatisticsDefault(),
        lookupTableAccount: PublicKey.default.toBase58(),
      };
    })
    .reduce((a, b) => {
      a[b.id] = b;
      return a;
    }, {} as { [id: string]: ApiClmmPoolsItem });

  if (findLookupTableAddress) {
    const ltas = await private_connection.getProgramAccounts(
      new PublicKey("AddressLookupTab1e1111111111111111111111111"),
      {
        filters: [
          {
            memcmp: {
              offset: 22,
              bytes: "RayZuc5vEK174xfgNFdD9YADqbbwbFjVjY4NM8itSF9",
            },
          },
        ],
      }
    );
    for (const itemLTA of ltas) {
      const keyStr = itemLTA.pubkey.toString();
      const ltaForamt = new AddressLookupTableAccount({
        key: itemLTA.pubkey,
        state: AddressLookupTableAccount.deserialize(itemLTA.account.data),
      });
      for (const itemKey of ltaForamt.state.addresses) {
        const itemKeyStr = itemKey.toString();
        if (poolInfoDict[itemKeyStr] === undefined) continue;
        poolInfoDict[itemKeyStr].lookupTableAccount = keyStr;
      }
    }
  }

  return Object.values(poolInfoDict);
}
