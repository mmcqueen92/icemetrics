import { Module } from '@nestjs/common';

import { NhlDataProvider } from './nhl/nhl-data.provider.js';
import { ProviderHttpClient } from './provider-http.client.js';

export const HOCKEY_DATA_PROVIDER = Symbol('HOCKEY_DATA_PROVIDER');

@Module({
  exports: [HOCKEY_DATA_PROVIDER, NhlDataProvider, ProviderHttpClient],
  providers: [
    ProviderHttpClient,
    NhlDataProvider,
    {
      provide: HOCKEY_DATA_PROVIDER,
      useExisting: NhlDataProvider,
    },
  ],
})
export class ProvidersModule {}
