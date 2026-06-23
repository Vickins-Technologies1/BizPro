import { nanoid } from "nanoid/non-secure";

export const createId = () => nanoid(16);

export const createEventId = () => `evt_${nanoid(20)}`;
