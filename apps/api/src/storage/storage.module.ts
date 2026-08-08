import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { CompanyFoldersService } from './company-folders.service';

@Global()
@Module({
  providers: [StorageService, CompanyFoldersService],
  exports: [StorageService, CompanyFoldersService],
})
export class StorageModule {}
