"use client";
import { useState } from "react";
import {
  hash,
  verify,
  generateSalt,
  generateKey,
  generateIv,
  encrypt,
  decrypt,
} from "./argon";

export default function Home() {
  const [password1, setPassword1] = useState("");
  const [showPassword1, setShowPassword1] = useState(false);
  const [password2, setPassword2] = useState("");
  const [showPassword2, setShowPassword2] = useState(false);
  const [hashedPassword, setHashedPassword] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [verificationAttempted, setVerificationAttempted] = useState(false);
  const [message, setMessage] = useState("");
  const [salt, setSalt] = useState("");
  const [key, setKey] = useState("");
  const [iv, setIv] = useState("");

  const text = "hola mundo";

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hashed = await hash(password1);
    setHashedPassword(hashed);
    console.log(hashed);
    const salt = await generateSalt();
    const key = await generateKey(password1, salt);
    const iv = await generateIv();
    setSalt(salt);
    setKey(key);
    setIv(iv);
    const encrypted = await encrypt(text, key, iv);
    setMessage(encrypted);
  };

  const checkPassword = async (e) => {
    e.preventDefault();
    const ans = await verify(password2, hashedPassword);
    console.log(ans);
    setIsValid(ans);
    setVerificationAttempted(true);
    if (ans) {
      const decrypted = await decrypt(message, key, iv);
      setMessage(decrypted);
    }
  };
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto space-y-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Vault
          </h1>
          <p className="text-muted-foreground">
            Secure password hashing with Argon2
          </p>
        </div>

        {/* Create Password Form */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Create Password
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="create-password"
                className="block text-sm font-medium mb-2 text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="create-password"
                  type={showPassword1 ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password1}
                  onChange={(e) => setPassword1(e.target.value)}
                  className="w-full px-4 py-3 pr-10 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword1(!showPassword1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword1 ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-background"
            >
              Hash Password
            </button>
          </form>
        </div>

        {/* Hashed Password Display */}
        {hashedPassword && (
          <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              Hashed Password
            </h2>
            <div className="bg-muted p-4 rounded-lg border border-border">
              <p className="text-sm font-mono break-all text-foreground">
                {hashedPassword}
              </p>
            </div>
          </div>
        )}

        {/* Message Display */}
        {message && (
          <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {verificationAttempted && isValid
                ? "Decrypted Message"
                : "Encrypted Message"}
            </h2>
            <div className="bg-muted p-4 rounded-lg border border-border">
              <p className="text-sm font-mono break-all text-foreground">
                {message}
              </p>
            </div>
          </div>
        )}

        {/* Check Password Form */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Verify Password
          </h2>
          <form onSubmit={checkPassword} className="space-y-4">
            <div>
              <label
                htmlFor="check-password"
                className="block text-sm font-medium mb-2 text-foreground"
              >
                Password to Verify
              </label>
              <div className="relative">
                <input
                  id="check-password"
                  type={showPassword2 ? "text" : "password"}
                  placeholder="Enter password to verify"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="w-full px-4 py-3 pr-10 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword2(!showPassword2)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword2 ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-background"
            >
              Verify Password
            </button>
          </form>
        </div>
        {/* Successfully verified */}
        {isValid && verificationAttempted && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-500 rounded-lg p-6 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-green-700 dark:text-green-400 mb-1">
                  Password Verified Successfully!
                </h3>
                <p className="text-green-600 dark:text-green-300">
                  The password matches the hash. Your verification was
                  successful.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Verification failed */}
        {!isValid && verificationAttempted && (
          <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border-2 border-red-500 rounded-lg p-6 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-1">
                  Password Verification Failed
                </h3>
                <p className="text-red-600 dark:text-red-300">
                  The password does not match the hash. Please check your input
                  and try again.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
