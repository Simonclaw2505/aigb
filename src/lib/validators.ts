/**
 * Zod validation schemas for security-critical forms
 * OWASP A03/A07: Input validation & strong authentication
 */

import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Adresse e-mail invalide")
  .max(255, "L'e-mail ne doit pas dépasser 255 caractères");

export const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères")
  .max(128, "Le mot de passe ne doit pas dépasser 128 caractères")
  .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre");

export const fullNameSchema = z
  .string()
  .trim()
  .max(100, "Le nom ne doit pas dépasser 100 caractères")
  .optional();

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Le mot de passe est requis"),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
});

export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;

/**
 * Password strength evaluator
 * Returns a score from 0-4 and a label
 */
export function evaluatePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels: { label: string; color: string }[] = [
    { label: "Très faible", color: "bg-red-500" },
    { label: "Faible", color: "bg-orange-500" },
    { label: "Moyen", color: "bg-yellow-500" },
    { label: "Fort", color: "bg-green-400" },
    { label: "Très fort", color: "bg-green-600" },
  ];

  const capped = Math.min(score, 4);
  return { score: capped, ...levels[capped] };
}
