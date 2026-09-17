import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import { SystemState, SystemStateDocument } from "./system-state.schema";
import { BranchesService } from "./modules/branches/branches.service";

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    @InjectModel(SystemState.name) private readonly systemStateModel: Model<SystemStateDocument>,
    private readonly configService: ConfigService,
    private readonly branchesService: BranchesService
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
    await this.branchesService.ensureDefaultBranches().catch((error) => {
      this.logger.warn(`Default branch migration skipped: ${error instanceof Error ? error.message : String(error)}`);
    });
    this.logger.log(`MongoDB bootstrap complete for database "${dbName}"`);
  }
}
