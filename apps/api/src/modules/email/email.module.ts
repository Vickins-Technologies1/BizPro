import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { EmailOutbox, EmailOutboxSchema } from "./email.schemas";
import { EmailService } from "./email.service";

@Global()
@Module({
  imports: [ConfigModule, MongooseModule.forFeature([{ name: EmailOutbox.name, schema: EmailOutboxSchema }])],
  providers: [EmailService],
  exports: [EmailService]
})
export class EmailModule {}
