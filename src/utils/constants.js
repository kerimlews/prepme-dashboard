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