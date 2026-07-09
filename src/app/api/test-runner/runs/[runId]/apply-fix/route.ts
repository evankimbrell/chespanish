import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import type { TestRun } from '@/lib/testing/types';
import * as dp from '@/lib/data-paths';

const RUNS_DIR = dp.TEST_RUNS_DIR;
const SRC_ROOT = path.join(process.cwd(), 'src');

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

interface FileEdit {
  filePath: string;
  description: string;
  oldString: string;
  newString: string;
}

function extractFilePaths(text: string): string[] {
  const matches = text.match(/src\/[a-zA-Z0-9/_\-[\].]+\.tsx?/g) ?? [];
  return [...new Set(matches)];
}

function readSourceFile(relPath: string): string | null {
  const absPath = path.join(process.cwd(), relPath);
  if (!absPath.startsWith(SRC_ROOT)) return null; // safety: only read src/
  if (!fs.existsSync(absPath)) return null;
  try {
    const content = fs.readFileSync(absPath, 'utf8');
    // Limit to 300 lines to avoid blowing context
    const lines = content.split('\n');
    if (lines.length > 300) {
      return lines.slice(0, 300).join('\n') + '\n... (truncated)';
    }
    return content;
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  // This route edits files under src/ — meaningful in dev, where the running code
  // is the working tree. In production the container's src/ isn't even what runs
  // (standalone build), so applying "fixes" there is pure confusion. Refuse.
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'apply-fix is disabled in production' }, { status: 403 });
  }
  const { runId } = await params;
  const runFile = path.join(RUNS_DIR, `${runId}.json`);

  if (!fs.existsSync(runFile)) {
    return Response.json({ error: 'Run not found' }, { status: 404 });
  }

  let run: TestRun;
  try {
    run = JSON.parse(fs.readFileSync(runFile, 'utf8')) as TestRun;
  } catch {
    return Response.json({ error: 'Failed to read run' }, { status: 500 });
  }

  if (!run.fixPlan && run.bugs.length === 0) {
    return Response.json({ error: 'No fix plan or bugs to implement' }, { status: 400 });
  }

  // Optional: fix only a single bug by ID
  let bugId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    bugId = body.bugId ?? null;
  } catch {}

  const bugsToFix = bugId ? run.bugs.filter((b) => b.id === bugId) : run.bugs;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {}
      };

      try {
        send('status', { message: 'Analyzing fix plan and identifying files to change…' });

        // Collect all file paths mentioned across bugs and fix plan
        const allText = [
          bugId ? '' : (run.fixPlan ?? ''),
          ...bugsToFix.map((b) => `${b.description} ${b.suggestedFix}`),
        ].join('\n');

        const mentionedPaths = extractFilePaths(allText);

        // Also include common grading/transcription files if bugs are in those categories
        const gradingBugs = bugsToFix.filter((b) => b.category === 'grading' || b.category === 'transcription');
        if (gradingBugs.length > 0) {
          mentionedPaths.push(
            'src/app/api/transcribe-and-grade/route.ts',
            'src/app/api/lesson/grade/route.ts',
            'src/app/api/grade/route.ts'
          );
        }

        const uniquePaths = [...new Set(mentionedPaths)].slice(0, 6);

        // Read each file
        const fileContents: Record<string, string> = {};
        for (const relPath of uniquePaths) {
          send('status', { message: `Reading ${relPath}…` });
          const content = readSourceFile(relPath);
          if (content) fileContents[relPath] = content;
        }

        const filesRead = Object.keys(fileContents);
        send('files_identified', {
          files: filesRead,
          message: `Found ${filesRead.length} file(s) to potentially edit`,
        });

        if (filesRead.length === 0) {
          send('status', { message: 'No specific files identified. Asking AI to determine which files need changes…' });
        }

        // Build the prompt
        const bugsText = bugsToFix
          .map(
            (b, i) =>
              `Bug ${i + 1} [${b.severity}/${b.category}]: ${b.description}\nSuggested fix: ${b.suggestedFix}`
          )
          .join('\n\n');

        const filesText =
          filesRead.length > 0
            ? filesRead
                .map((p) => `=== ${p} ===\n${fileContents[p]}`)
                .join('\n\n')
            : '(No specific files identified — use your knowledge of Next.js App Router structure)';

        const SYSTEM = `You are implementing bug fixes for a Next.js TypeScript codebase. Based on the bug descriptions and fix plan, generate specific, minimal file edits.

Return ONLY valid JSON in this exact format:
{
  "edits": [
    {
      "filePath": "src/app/api/...",
      "description": "brief description of this edit",
      "oldString": "exact verbatim string to find (must be unique in the file, include 2-3 lines of context)",
      "newString": "replacement string"
    }
  ],
  "summary": "one-sentence summary of all changes made"
}

Critical requirements:
- oldString MUST be an exact verbatim substring of the file content shown — copy it character-for-character
- Include enough surrounding context in oldString that it's unique in the file
- Keep changes minimal — only change what the bug fix requires
- If you cannot find a safe edit to make, return { "edits": [], "summary": "No safe edits identified" }
- Do not modify test runner files (src/app/api/test-runner/, src/lib/testing/)`;

        const fixPlanSection = bugId ? '' : `Fix Plan:\n${run.fixPlan ?? '(none — use bug descriptions)'}\n\n`;
        const userMsg = `${fixPlanSection}Bugs to fix:\n${bugsText}\n\nSource files:\n${filesText}`;

        send('status', { message: 'Generating code edits with AI…' });

        const completion = await getOpenAI().chat.completions.create({
          model: 'gpt-5.5',
          response_format: { type: 'json_object' },
          max_completion_tokens: 3000,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: userMsg },
          ],
        });

        const result = JSON.parse(completion.choices[0].message.content ?? '{"edits":[]}');
        const edits: FileEdit[] = result.edits ?? [];

        if (edits.length === 0) {
          send('complete', {
            filesChanged: [],
            editsApplied: 0,
            summary: result.summary ?? 'No edits generated',
          });
          // Mark as applied even with 0 edits
          run.fixesApplied = true;
          fs.writeFileSync(runFile, JSON.stringify(run, null, 2));
          controller.close();
          return;
        }

        // Apply edits
        const applied: string[] = [];
        const skipped: string[] = [];

        for (const edit of edits) {
          const absPath = path.join(process.cwd(), edit.filePath);
          if (!absPath.startsWith(SRC_ROOT)) {
            skipped.push(`${edit.filePath} (outside src/)`);
            continue;
          }

          if (!fs.existsSync(absPath)) {
            skipped.push(`${edit.filePath} (file not found)`);
            continue;
          }

          const current = fs.readFileSync(absPath, 'utf8');
          if (!current.includes(edit.oldString)) {
            send('warning', {
              message: `Could not find target string in ${edit.filePath} — skipping this edit`,
              description: edit.description,
            });
            skipped.push(`${edit.filePath} (string not found)`);
            continue;
          }

          const updated = current.replace(edit.oldString, edit.newString);
          fs.writeFileSync(absPath, updated, 'utf8');
          applied.push(edit.filePath);

          send('edit_applied', {
            filePath: edit.filePath,
            description: edit.description,
          });
        }

        // Mark run as having fixes applied
        run.fixesApplied = true;
        fs.writeFileSync(runFile, JSON.stringify(run, null, 2));

        send('complete', {
          filesChanged: [...new Set(applied)],
          editsApplied: applied.length,
          editsSkipped: skipped.length,
          summary: result.summary ?? `Applied ${applied.length} edit(s)`,
          skipped,
        });
      } catch (e) {
        send('error', { message: String(e) });
        console.error('[apply-fix] Error:', e);
      } finally {
        controller.close();
      }
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
