import { validate, res } from "email-validator";

export function validateEmail(email: string): boolean {
  validate(email); // true
  if (res) {
    console.log("Email is valid");
    return true;
  } else {
    console.log("Email is invalid");
    return false;
  }
}
