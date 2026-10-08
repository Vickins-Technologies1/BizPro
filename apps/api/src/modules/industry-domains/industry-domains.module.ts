import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { IndustryDomainsController } from "./industry-domains.controller";
import { IndustryDomainsService } from "./industry-domains.service";
import { Matter, MatterSchema, MatterTask, MatterTaskSchema, Patient, PatientSchema, Reservation, ReservationSchema, Room, RoomCharge, RoomChargeSchema, RoomSchema, RoomType, RoomTypeSchema, Stay, StaySchema, TimeEntry, TimeEntrySchema, Visit, VisitSchema } from "../industry-domains.schemas";

@Module({
  imports: [MongooseModule.forFeature([
    { name: RoomType.name, schema: RoomTypeSchema }, { name: Room.name, schema: RoomSchema }, { name: Reservation.name, schema: ReservationSchema }, { name: Stay.name, schema: StaySchema }, { name: RoomCharge.name, schema: RoomChargeSchema },
    { name: Patient.name, schema: PatientSchema }, { name: Visit.name, schema: VisitSchema },
    { name: Matter.name, schema: MatterSchema }, { name: MatterTask.name, schema: MatterTaskSchema },
    { name: TimeEntry.name, schema: TimeEntrySchema }
  ])],
  controllers: [IndustryDomainsController],
  providers: [IndustryDomainsService]
})
export class IndustryDomainsModule {}
