import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import { SystemState, SystemStateDocument } from "./system-state.schema";

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    @InjectModel(SystemState.name) private readonly systemStateModel: Model<SystemStateDocument>,
    private readonly configService: ConfigService
  ) {}

  async onModuleInit() {
    const dbName = this.configService.get<string>("MONGODB_DB_NAME") ?? "vickins_business_os";
    await this.systemStateModel.updateOne(
      { key: "database-bootstrap" },
      {
        $setOnInsert: {
          key: "database-bootstrap",
          value: "ready"
        }
      },
      { upsert: true }
    );
    this.logger.log(`MongoDB bootstrap complete for database "${dbName}"`);
  }
}
