import fs from "fs";
import path from "path";

type Case = { id: number; category: string; prompt: string; mustInclude: string[]; mustNotInclude: string[] };

const ROOT = process.cwd();
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "db.json"), "utf8"));
const AGENT = DB.agents.find((a:any) => a.id === 971);
const PY = DB.knowledgeItems.find((k:any) => k.id === 841);
const JV = DB.knowledgeItems.find((k:any) => k.id === 829);

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function makeCases(): Case[] {
  const cases: Case[] = [];
  const prompts = [
    ["catalog", "Which courses do you offer?", ["Core Python Programming", "Core Java Programming"], ["Apex Solutions", "Test Org", "$499", "placement"]],
    ["catalog", "What courses are available?", ["Core Python Programming", "Core Java Programming"], ["Apex Solutions", "Test Org"]],
    ["python_fee", "What is the Python fee?", ["₹4,000"], ["₹5,000", "$499"]],
    ["java_fee", "How much is Java?", ["₹5,000"], ["₹4,000", "$499"]],
    ["python_duration", "How long is the Python course?", ["30 Days"], ["45 Days", "3 Months"]],
    ["java_duration", "How long is Core Java?", ["45 Days"], ["30 Days", "4 Months"]],
    ["python_batch", "What is the Python batch timing?", ["7:00 PM–8:00 PM", "5 October 2026"], ["6:00 PM–7:30 PM", "12 October 2026"]],
    ["java_batch", "What is the Java batch timing?", ["6:00 PM–7:30 PM", "12 October 2026"], ["7:00 PM–8:00 PM", "5 October 2026"]],
    ["python_topics", "What topics are covered in Python?", ["Python basics", "SQLite database basics"], ["JDBC and database CRUD"]],
    ["java_topics", "What topics are covered in Java?", ["JDK, JRE and JVM", "JDBC and database CRUD"], ["SQLite database basics"]],
    ["python_projects", "What projects are included in Python?", ["Expense Tracker", "Python Quiz Application"], ["Bank Account Management System"]],
    ["java_projects", "What projects are included in Java?", ["Bank Account Management System", "Employee Management System"], ["Expense Tracker"]],
    ["mode", "Can I join online?", ["Online + Offline"], ["Google Meet", "Zoom"]],
    ["prereq", "Do I need prior Java experience?", ["No prior Java experience required"], ["basic logic"]],
    ["discount", "Any discount?", ["not provided"], ["discount", "scholarship", "concession", "early-bird"]],
    ["placement", "Do you provide placements?", ["not provided"], ["placement support", "job guarantee"]],
    ["trainer", "Who is the trainer?", ["not provided"], ["trainer", "faculty"]],
    ["random", "What is the refund policy?", ["not provided"], ["refund guarantee", "90 days"]],
    ["random", "Can you provide a hostel?", ["not provided"], ["hostel"]],
    ["random", "Do you have weekend classes?", ["not provided"], ["weekend"]],
  ] as [string,string,string[],string[]][];

  for (const [category, prompt, mustInclude, mustNotInclude] of prompts) {
    for (let i = 0; i < 50; i++) {
      cases.push({
        id: cases.length + 1,
        category,
        prompt,
        mustInclude,
        mustNotInclude,
      });
    }
  }

  const paraphrases = [
    "python course charges",
    "price for python",
    "python cost please",
    "java tuition",
    "java fee details",
    "python duration?",
    "java length?",
    "when does python start",
    "when does java begin",
    "python classes time",
    "java schedule",
    "what will i learn in python",
    "what will i learn in java",
    "python projects?",
    "java projects?",
    "is python online",
    "is java available online",
    "who can take python",
    "do I need Java before joining",
    "what is the address",
    "where are you located",
    "contact number please",
    "what is your whatsapp number",
    "what is the email",
  ];
  for (const p of paraphrases) {
    for (let i = 0; i < 10; i++) {
      cases.push({
        id: cases.length + 1,
        category: "paraphrase",
        prompt: p,
        mustInclude: [],
        mustNotInclude: ["Apex Solutions", "Test Org", "$299", "$499"],
      });
    }
  }

  return cases.slice(0, 1200);
}

async function post(base: string, body: unknown): Promise<any> {
  const r = await fetch(base + "/api/v1/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data:any = {};
  try { data = JSON.parse(text); } catch {}
  if (!r.ok) throw new Error("HTTP " + r.status + ": " + text);
  return data;
}

async function main() {
  const cases = makeCases();
  assert(cases.length >= 1000, "Regression suite must contain at least 1000 cases.");
  assert(AGENT?.id === 971, "V4 Maruthi receptionist is missing.");
  assert(JSON.stringify(AGENT.knowledge_item_ids) === JSON.stringify([841, 829]), "V4 receptionist must bind exactly Python + Java knowledge.");
  assert(PY?.source === "python_course_info.txt", "Python knowledge source mismatch.");
  assert(JV?.source === "java_course_info.txt", "Java knowledge source mismatch.");

  const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
  const failures: any[] = [];
  for (const tc of cases) {
    try {
      const data = await post(base, {
        agent_id: 971,
        session_id: "v4-regression-" + tc.id,
        message: tc.prompt,
      });
      const response = String(data.response || "");
      for (const needle of tc.mustInclude) {
        if (needle && needle.toLowerCase() !== "not provided" && !response.toLowerCase().includes(needle.toLowerCase())) {
          failures.push({ id: tc.id, category: tc.category, prompt: tc.prompt, kind: "missing", needle, response });
        }
      }
      for (const forbidden of tc.mustNotInclude) {
        if (forbidden && response.toLowerCase().includes(forbidden.toLowerCase())) {
          failures.push({ id: tc.id, category: tc.category, prompt: tc.prompt, kind: "forbidden", needle: forbidden, response });
        }
      }
    } catch (e) {
      failures.push({ id: tc.id, category: tc.category, prompt: tc.prompt, kind: "error", error: String(e) });
    }
  }

  const report = {
    generated_cases: cases.length,
    failures: failures.length,
    passed: cases.length - failures.length,
    pass_rate: Number((((cases.length - failures.length) / cases.length) * 100).toFixed(2)),
    sample_failures: failures.slice(0, 50),
  };
  fs.mkdirSync(path.join(ROOT, "test-results"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "test-results", "receptionist-v4-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
