export const shopifyConfig = {
  storeUrl: 'https://6be389.myshopify.com',
  accessToken: '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',
  headers: {
    'X-Shopify-Access-Token': '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',
    'Content-Type': 'application/json'
  }
};

export const nonXLProducts = [
  'Proteinske Kokos Kuglice',
  'Proteinski Choco Brownie',
  'Proteinske Choco Kuglice'
];

export const sizeMapping = {
  5: '*M',
  11: '*S',
  17: '*X',
  28: '*XL'
};

export const DEFAULT_SUBSCRIPTION = { current: 1, total: 1 };