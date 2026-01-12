import { validate } from "email-validator";

export function validateEmail(email: string): boolean {
  const isValid = validate(email);
  if (isValid) {
    console.log("Email is valid");
  } else {
    console.log("Email is invalid");
  }
  return isValid;
}
