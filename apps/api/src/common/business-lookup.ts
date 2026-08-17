import { Types } from "mongoose";

export function buildBusinessLookup(identifier: string) {
  const trimmed = identifier.trim();
  const candidates: Array<Record<string, unknown>> = [{ externalId: trimmed }];

  if (Types.ObjectId.isValid(trimmed)) {
    candidates.push({ _id: new Types.ObjectId(trimmed) });
  }

  return {
    deletedAt: null,
    $or: candidates
  };
}

export async function findBusinessByIdentifier(businessModel: any, identifier: string): Promise<any> {
  return businessModel.findOne(buildBusinessLookup(identifier)).lean();
}
