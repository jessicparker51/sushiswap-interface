import Search from 'app/components/Search'
import { Feature } from 'app/enums'
import AnalyticsContainer from 'app/features/analytics/AnalyticsContainer'
import Background from 'app/features/analytics/Background'
import InfoCard from 'app/features/analytics/bar/InfoCard'
import TokenTable from 'app/features/analytics/bentobox/TokenTable'
import { featureEnabled } from 'app/functions/feature'
import { formatNumber } from 'app/functions/format'
import useFuse from 'app/hooks/useFuse'
import { useBentoBox, useBentoStrategies, useNativePrice, useTokens } from 'app/services/graph'
import { useRouter } from 'next/router'
import { useMemo } from 'react'

export default function BentoBox(): JSX.Element {
  const router = useRouter()

  const chainId = Number(router.query.chainId)

  const nativePrice = useNativePrice({ chainId })

  // Get exchange data
  const tokens = useTokens({ chainId })

  // Creating map to easily reference TokenId -> Token
  const tokenIdToPrice = useMemo<
    Map<string, { derivedETH: number; volumeUSD: number; dayData: Array<{ priceUSD: number }> }>
  >(() => {
    // @ts-ignore TYPE NEEDS FIXING
    return new Map(tokens?.map((token) => [token.id, token]))
  }, [tokens])

  // @ts-ignore TYPE NEEDS FIXING
  const bentoBox = useBentoBox({ chainId, shouldFetch: featureEnabled(Feature.BENTOBOX, chainId) })

  const strategies = useBentoStrategies({ chainId })

  // Combine Bento Box Tokens with Token data from exchange
  const bentoBoxTokensFormatted = useMemo<Array<any>>(
    () =>
      (bentoBox?.tokens || [])
        // @ts-ignore TYPE NEEDS FIXING
        ?.map(({ id, totalSupplyElastic, decimals, symbol, name }) => {
          const token = tokenIdToPrice.get(id)
          const supply = totalSupplyElastic / Math.pow(10, decimals)
          const tokenDerivedETH = token?.derivedETH
          const price = (tokenDerivedETH ?? 0) * nativePrice
          const tvl = price * supply

          // @ts-ignore
          const strategy = strategies?.find((strategy) => strategy.token === id)

          return {
            token: {
              id,
              symbol,
              name,
              decimals,
            },
            strategy,
            price,
            liquidity: tvl,
          }
        })
        .filter(Boolean),
    [bentoBox?.tokens, tokenIdToPrice, nativePrice, strategies]
  )

  const {
    result: searched,
    term,
    search,
  } = useFuse({
    options: {
      keys: ['token.address', 'token.symbol', 'token.name'],
      threshold: 0.4,
    },
    data: bentoBoxTokensFormatted,
  })

  return (
    <AnalyticsContainer>
      <Background background="dashboard">
        <div className="grid items-center justify-between grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
          <div>
            <div className="text-3xl font-bold text-high-emphesis">BentoBox</div>
            <div className="">Click on the column name to sort tokens by price or liquidity.</div>
          </div>
          <Search term={term} search={search} />
        </div>
      </Background>
      <div className="py-6 space-y-4 lg:px-14">
        <div className="text-2xl font-bold text-high-emphesis">Overview</div>
        <div className="flex flex-row space-x-4 overflow-auto">
          <InfoCard
            text="TVL"
            number={formatNumber(
              bentoBoxTokensFormatted?.reduce((prev, curr) => prev + curr.liquidity, 0),
              true,
              false
            )}
          />
          <InfoCard text="Total Users" number={formatNumber(bentoBox?.totalUsers)} />
          <InfoCard text="Total Tokens" number={bentoBox?.totalTokens} />
          <InfoCard text="Total Kashi Pairs" number={bentoBox?.totalKashiPairs} />
        </div>
      </div>
      <div className="pt-4 lg:px-14">
        <TokenTable chainId={chainId} tokens={searched} />
      </div>
    </AnalyticsContainer>
  )
}
