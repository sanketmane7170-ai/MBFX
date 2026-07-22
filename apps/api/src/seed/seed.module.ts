import { Module } from '@nestjs/common';
import { SuperAdminSeeder } from './super-admin.seeder';

@Module({
  providers: [SuperAdminSeeder],
})
export class SeedModule {}
