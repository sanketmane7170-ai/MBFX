import { Global, Module } from '@nestjs/common';
import { COPIER_PROVIDER } from './copier.types';
import { MockCopierProvider } from './mock-copier.provider';
import { MetaApiCopierProvider } from './metaapi-copier.provider';
import { CopierDispatcher } from './copier-dispatcher';

/**
 * COPIER_PROVIDER is a dispatcher that picks the real MetaApi provider when a
 * token is configured (Settings/env), otherwise the mock — decided per call.
 */
@Global()
@Module({
  providers: [
    MockCopierProvider,
    MetaApiCopierProvider,
    CopierDispatcher,
    { provide: COPIER_PROVIDER, useExisting: CopierDispatcher },
  ],
  exports: [COPIER_PROVIDER],
})
export class CopierModule {}
