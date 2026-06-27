import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({ timestamps: true, collection: "system_state" })
export class SystemState {
  @Prop({ required: true, unique: true, index: true })
  key!: string;

  @Prop({ required: true })
  value!: string;
}

export type SystemStateDocument = HydratedDocument<SystemState>;
export const SystemStateSchema = SchemaFactory.createForClass(SystemState);
