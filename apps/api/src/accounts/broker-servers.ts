/**
 * Seed list of common MT4/MT5 broker server names.
 *
 * MetaApi has no broker-server directory API (the SDK only accepts a serverName
 * string), so suggestions are this curated seed merged with the servers already
 * in use on this platform. It is a convenience list, never a whitelist — the UI
 * always allows free text, since brokers add/rename servers constantly.
 */
export const COMMON_BROKER_SERVERS: string[] = [
  // Exness
  'Exness-MT5Trial', 'Exness-MT5Trial6', 'Exness-MT5Trial7', 'Exness-MT5Trial8',
  'Exness-MT5Real', 'Exness-MT5Real2', 'Exness-MT5Real8', 'Exness-MT5Real9',
  'Exness-MT4Trial', 'Exness-MT4Trial6', 'Exness-MT4Real', 'Exness-MT4Real8',
  // IC Markets
  'ICMarkets-Demo', 'ICMarkets-Demo02', 'ICMarkets-Live01', 'ICMarkets-Live02',
  'ICMarketsSC-Demo', 'ICMarketsSC-Live01', 'ICMarketsSC-Live02', 'ICMarketsEU-Live',
  // Pepperstone
  'Pepperstone-Demo', 'Pepperstone-Edge01', 'Pepperstone-Live01', 'Pepperstone-MT5-Live01',
  // XM
  'XMGlobal-Demo', 'XMGlobal-Demo 2', 'XMGlobal-MT5', 'XMGlobal-MT5 2', 'XMGlobal-Real 3',
  // FTMO / prop
  'FTMO-Demo', 'FTMO-Server', 'FTMO-Server2', 'FundedNext-Server', 'FundedNext-Demo',
  'TheFundedTrader-Server', 'MyForexFunds-Live',
  // Others
  'Deriv-Demo', 'Deriv-Server', 'Deriv-Server-02',
  'RoboForex-Demo', 'RoboForex-Pro', 'RoboForex-ECN',
  'OctaFX-Demo', 'OctaFX-Real', 'OctaFX-Real2',
  'FXTM-Demo', 'FXTM-ECN', 'Alpari-Demo', 'Alpari-Standard',
  'AdmiralMarkets-Demo', 'AdmiralMarkets-Live',
  'Tickmill-Demo', 'Tickmill-Live', 'Tickmill-Live02',
  'FXOpen-Demo', 'FXOpen-ECN', 'HFMarketsGlobal-Demo', 'HFMarketsGlobal-Live',
  'Vantage-Demo', 'Vantage-Live', 'Vantage-Live 3',
  'Eightcap-Demo', 'Eightcap-Live', 'BlueberryMarkets-Live',
  'Axi-US03-Demo', 'Axi-US03-Live', 'ThinkMarkets-Demo', 'ThinkMarkets-Live',
  'FusionMarkets-Demo', 'FusionMarkets-Live', 'GoMarkets-Live',
  'Swissquote-Demo', 'Swissquote-Live', 'Dukascopy-Demo', 'Dukascopy-Live',
  'MetaQuotes-Demo',
];
