import { NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export const runtime = "nodejs";

type JobSummaryBody = {
  kind: "job";
  description?: string;
  serviceTypeName?: string;
  status?: number;
  jobId?: number;
};

type BuilderJobSnippet = {
  serviceTypeName?: string;
  description?: string;
  status?: number;
};

type BuilderSummaryBody = {
  kind: "builder";
  address?: string;
  jobs?: BuilderJobSnippet[];
};

type SummaryBody = JobSummaryBody | BuilderSummaryBody;

const truncate = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max)}…`);

function fallbackJobSummary(description: string): string {
  const cleaned = description.replace(/\s+/g, " ").trim();
  if (!cleaned) return "LeftClaw job with no on-chain description.";
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  return truncate(sentence, 180);
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  let body: SummaryBody;
  try {
    body = (await req.json()) as SummaryBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.kind !== "job" && body.kind !== "builder") {
    return NextResponse.json({ error: "kind must be job or builder" }, { status: 400 });
  }

  if (!apiKey) {
    if (body.kind === "job") {
      return NextResponse.json({ summary: fallbackJobSummary(body.description ?? "") });
    }
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const model = google("gemini-2.5-flash");

  try {
    if (body.kind === "job") {
      const description = truncate((body.description ?? "").trim(), 1200);
      const service = body.serviceTypeName ?? "LeftClaw job";
      const { text } = await generateText({
        model,
        temperature: 0.3,
        prompt: [
          "Write exactly ONE plain sentence summarizing this LeftClaw on-chain job for a public portfolio explorer.",
          "No markdown, no quotes, no preamble. Focus on what was requested.",
          `Service type: ${service}`,
          `Status code: ${body.status ?? "unknown"}`,
          `Description: ${description || "(empty)"}`,
        ].join("\n"),
      });
      const summary = text.replace(/\s+/g, " ").trim() || fallbackJobSummary(description);
      return NextResponse.json({ summary });
    }

    const jobs = (body.jobs ?? []).slice(0, 12).map(j => ({
      serviceTypeName: j.serviceTypeName ?? "Job",
      status: j.status,
      description: truncate((j.description ?? "").trim(), 280),
    }));

    const { text } = await generateText({
      model,
      temperature: 0.4,
      prompt: [
        "Write exactly THREE plain sentences about this LeftClaw builder's public work history.",
        "Cover focus areas, volume/mix of work, and overall vibe. No markdown, no bullet points, no preamble.",
        `Wallet: ${body.address ?? "unknown"}`,
        `Jobs (JSON): ${JSON.stringify(jobs)}`,
      ].join("\n"),
    });
    const summary = text.replace(/\s+/g, " ").trim();
    if (!summary) {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }
    return NextResponse.json({ summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Summary generation failed";
    if (body.kind === "job") {
      return NextResponse.json({ summary: fallbackJobSummary(body.description ?? "") });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
