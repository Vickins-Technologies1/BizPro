import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "./modules/auth/auth.module";
import { BusinessesModule } from "./modules/businesses/businesses.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { BrandsModule } from "./modules/brands/brands.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { DevicesModule } from "./modules/devices/devices.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { ProductsModule } from "./modules/products/products.module";
import { PurchaseOrdersModule } from "./modules/purchase-orders/purchase-orders.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { SalesModule } from "./modules/sales/sales.module";
import { StockTransfersModule } from "./modules/stock-transfers/stock-transfers.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { SyncModule } from "./modules/sync/sync.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { AuditModule } from "./modules/audit/audit.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { JwtAuthGuard } from "./common/jwt-auth.guard";
import { RolesGuard } from "./common/roles.guard";
import { SupportKeyGuard } from "./common/support-key.guard";
import { HealthController } from "./health.controller";
import { BootstrapService } from "./bootstrap.service";
import { SystemState, SystemStateSchema } from "./system-state.schema";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGODB_URI") ?? "mongodb://127.0.0.1:27017/vickins_business_os",
        dbName: config.get<string>("MONGODB_DB_NAME") ?? "vickins_business_os"
      })
    }),
    MongooseModule.forFeature([{ name: SystemState.name, schema: SystemStateSchema }]),
    AuthModule,
    BusinessesModule,
    CategoriesModule,
    BrandsModule,
    CustomersModule,
    DevicesModule,
    ExpensesModule,
    FinanceModule,
    ProductsModule,
    PurchaseOrdersModule,
    ReportsModule,
    SalesModule,
    StockTransfersModule,
    SubscriptionsModule,
    SyncModule,
    WebhooksModule,
    AuditModule,
    AnalyticsModule,
    EmployeesModule,
    SuppliersModule,
    NotificationsModule
  ],
  controllers: [HealthController],
  providers: [JwtAuthGuard, RolesGuard, SupportKeyGuard, BootstrapService]
})
export class AppModule {}
