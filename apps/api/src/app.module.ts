import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "./modules/auth/auth.module";
import { BusinessesModule } from "./modules/businesses/businesses.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { DevicesModule } from "./modules/devices/devices.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { ProductsModule } from "./modules/products/products.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { SalesModule } from "./modules/sales/sales.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { SyncModule } from "./modules/sync/sync.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { AuditModule } from "./modules/audit/audit.module";
import { JwtAuthGuard } from "./common/jwt-auth.guard";
import { RolesGuard } from "./common/roles.guard";
import { SupportKeyGuard } from "./common/support-key.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGODB_URI") ?? "mongodb://127.0.0.1:27017/vickins_business_os"
      })
    }),
    AuthModule,
    BusinessesModule,
    CategoriesModule,
    CustomersModule,
    DevicesModule,
    ExpensesModule,
    ProductsModule,
    ReportsModule,
    SalesModule,
    SubscriptionsModule,
    SyncModule,
    WebhooksModule,
    AuditModule
  ],
  providers: [JwtAuthGuard, RolesGuard, SupportKeyGuard]
})
export class AppModule {}
