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