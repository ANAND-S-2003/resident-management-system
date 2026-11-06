import { z } from "zod";
import { codePointLength } from "@/lib/validation/schemas";
import { parseDateOnly } from "@/lib/dates";

export function requestFormSchema(minDate: string) {
  return z.object({
    serviceId: z
      .string()
      .refine(
        (value) => /^\d+$/.test(value) && Number(value) > 0,
        "Choose a service.",
      ),
    description: z
      .string()
      .transform((value) => value.trim())
      .refine(
        (value) => codePointLength(value) >= 5,
        "Description must be at least 5 characters.",
      )
      .refine(
        (value) => codePointLength(value) <= 1000,
        "Description must be at most 1000 characters.",
      ),
    expectedCompletionDate: z
      .string()
      .min(1, "Choose an expected completion date.")
      .refine((value) => parseDateOnly(value) !== null, "Enter a valid date.")
      .refine(
        (value) => value >= minDate,
        "Expected completion date cannot be before today.",
      ),
  });
}

export type RequestFormValues = z.infer<ReturnType<typeof requestFormSchema>>;
