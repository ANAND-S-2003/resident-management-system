import { z } from "zod";
import {
  codePointLength,
  emailSchema,
  flatNumberSchema,
  fullNameSchema,
  trimmedString,
} from "@/lib/validation/schemas";
import { passwordSchema } from "@/lib/validation/schemas";

const serviceName = trimmedString().refine(
  (value) => codePointLength(value) >= 2 && codePointLength(value) <= 100,
  "Name must be between 2 and 100 characters.",
);
const serviceDescription = trimmedString().refine(
  (value) => codePointLength(value) <= 500,
  "Description must be no more than 500 characters.",
);
export const serviceFormSchema = z.object({
  name: serviceName,
  description: serviceDescription,
});

export const residentCreateSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  flatNumber: flatNumberSchema,
  password: passwordSchema,
});
export const adminCreateSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export const residentEditSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  flatNumber: flatNumberSchema,
});
export const adminEditSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
});

export const contactFormSchema = z.object({
  name: trimmedString().refine(
    (value) => codePointLength(value) >= 2 && codePointLength(value) <= 120,
    "Name must be between 2 and 120 characters.",
  ),
  email: emailSchema,
  subject: trimmedString().refine(
    (value) => codePointLength(value) >= 3 && codePointLength(value) <= 200,
    "Subject must be between 3 and 200 characters.",
  ),
  message: trimmedString().refine(
    (value) => codePointLength(value) >= 5 && codePointLength(value) <= 2000,
    "Message must be between 5 and 2000 characters.",
  ),
});
