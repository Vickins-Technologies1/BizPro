import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { businessSchemas, catalogSchemas, financeSchemas, opsSchemas } from "../schemas";
import { BranchesController } from "./branches.controller";
import { BranchesService } from "./branches.service";

@Module({
  imports: [MongooseModule.forFeature([...businessSchemas, ...catalogSchemas, ...financeSchemas, ...opsSchemas])],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService]
})
export class BranchesModule {}
