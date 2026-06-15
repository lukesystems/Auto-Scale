import { AIError } from "@/services/ai/types";
import { ProviderSetupError } from "@/services/providers/config";

export function isAIError(err: unknown): err is AIError {
  return err instanceof AIError || (err instanceof Error && err.name === "AIError");
}

export function isProviderSetupError(err: unknown): err is ProviderSetupError {
  return err instanceof ProviderSetupError || (err instanceof Error && err.name === "ProviderSetupError");
}

export function mapAutoBriefError(err: unknown, fetchFailed: boolean): string {
  if (isProviderSetupError(err)) {
    if (err.code === "openrouter_missing") {
      return "OpenRouter is not configured on the server. Use manual entry or switch to mock provider for local testing.";
    }
    return err.message;
  }

  if (isAIError(err)) {
    if (err.message.includes("timed out")) {
      return err.message;
    }
    if (err.message.includes("Failed to produce valid structured output")) {
      if (!fetchFailed) {
        return "AutoBrief could not generate structured output. Try again, use manual entry, or switch to mock provider for local testing.";
      }
      return "AutoBrief could not generate structured output from the available inputs. Try again, add manual details, or switch to mock provider for local testing.";
    }
    if (err.message.includes("request failed")) {
      if (err.message.includes("404") || err.message.match(/\bmodel\b/i)) {
        return "The configured AI model is invalid or unavailable. Check your model slug in settings or use manual entry.";
      }
      return "AI provider request failed. Try again, use manual entry, or check provider status.";
    }
    return err.message;
  }

  if (err instanceof Error) {
    if (err.message.includes("timed out")) {
      return err.message;
    }
    if (err.message.match(/\binvalid model\b|\bmissing model\b|\bmodel slug\b/i)) {
      return "The configured AI model is invalid or missing. Check your model slug or use manual entry.";
    }
    return err.message;
  }

  return "AutoBrief generation failed. Try again or use manual entry.";
}
