# Global Configuration

## Project Search
- When looking for project files (MCP servers, services, configs), always start searching in the current working directory first before looking elsewhere

# Prompting Guide for n8n with Grok 4/4.1 Fast (non-reasoning)

Models used: grok-4-fast-non-reasoning (orchestrator) and grok-4.1-fast-non-reasoning (sub-agents)

Sources:
- Official xAI guide for grok-code-fast-1 (adapted, excluding reasoning): https://docs.x.ai/docs/guides/grok-code-prompt-engineering
- n8n community: community.n8n.io, Width.ai, Hatchworks
- Grok community: PromptLayer, Pantaleone, Arsturn, Cyber Raiden

## Format rules for n8n

- Write system prompts in ENGLISH (the model responds in whatever language you instruct within the prompt)
- Plain text with clear paragraphs. In n8n this is the safest because LangChain injects automatic format_instructions that can conflict with markup (markdown headers, XML tags)
- Use single # sections if you need to separate blocks
- No hierarchical markdown headers (## ###), no XML tags, no nested bullet points
- n8n's structured output parser breaks with triple backticks inside JSON. n8n recommends: "Structured output parsing is often not reliable with agents. Use a separate LLM-chain to parse."
- Most important information at the START and END of the prompt ("lost in the middle" effect)
- Maximum 2-4 tools per agent. More confuses the model and causes incorrect tool selection
- If prompt exceeds ~1000 tokens, split into specialized sub-agents instead of one giant agent

## Prompting rules for Grok 4/4.1 Fast

# Detailed system prompt
xAI says: "A well-written system prompt which describes the task, expectations, and edge-cases the model should be aware of can make a night-and-day difference."
Include: clear task, expectations, and edge-cases the model should handle.

# Surgical context
Only data relevant to the case. Irrelevant context causes "unnecessary deviations".
Bad: "Make error handling better"
Good: "My error codes are defined in @errors.ts, can you use that as reference to add proper error handling to @sql.ts"

# Explicit goals
Vague prompts produce generic results. xAI says: "Detailed, concrete queries yield better performance."
Bad: "Create a food tracker"
Good: "Create a food tracker which shows the breakdown of calorie consumption per day divided by different nutrients when I enter a food item"

# Affirmative instructions, never negative
Negations ("Don't ask for confirmation", "Don't be technical") do not work. The model frequently ignores them. Use positive instructions that say what to do.
Bad: "Don't be technical"
Good: "Use simple terms with everyday analogies"

# Do not describe tools in the prompt
n8n injects tool definitions automatically via LangChain. Your prompt only describes WHEN and WHY to use each action, not WHAT the tool is. Describing tools manually wastes tokens and can cause confusion.
Describe as natural actions: "look up the customer", "check equipment status", "transfer to an agent". Never technical names (transferir_cliente, buscar_orden) or refer to them as "tool" or "herramienta".

# One clear task per prompt
Do not mix unrelated tasks in the same prompt. Combining multiple questions confuses the model.

# Grok is concise by default
Grok operates at ~3/10 verbosity. You do not need to ask for brevity. If you need long responses, explicitly request "deep dive" or detailed treatment.

# Skip politeness
"Please", "thank you" waste tokens with no benefit. Go straight to the point.

# Fast iteration
xAI says: "Even if the initial output isn't perfect, we strongly suggest taking advantage of the uniquely rapid and cost-effective iteration to refine your query."

# Agentic tasks
These models are optimized for sequential tool use, not one-shot Q&A. xAI says: "Use for agentic-style tasks, not one-shot queries."

## Recommended system prompt structure for n8n

Based on Width.ai and n8n community, a good system prompt has these components in this order:

1. Role/Identity - who the agent is, its main objective
2. Tools - when and why to use each action (in natural language)
3. Tone - response tone and style
4. Rules - restrictions and business rules
5. Examples - 2-3 few-shot showing decision logic (not full outputs)
6. Context - relevant data for the case
7. Output Format - expected response format

(Repeat the most critical rule at the end of the prompt)

## Agent architecture patterns for n8n

# Context layering
Each layer handles one responsibility: tool descriptions describe WHAT actions do and return, system prompts describe WHEN and WHY (decision logic), n8n expressions inject dynamic context, memory nodes store conversation history. If a tool description already explains what data it returns, the system prompt must not repeat it. If the orchestrator's agentTool toolDescription lists which topics a specialist handles, the orchestrator's system prompt only handles edge cases and behavioral rules.

# Sub-agent splitting
When a single agent exceeds 4 tools, split by customer journey stage or functional domain (e.g. pre-sale vs post-sale, technical vs billing). Each sub-agent handles one coherent scenario set and needs a fallback for out-of-scope queries: a short message ending the turn so the orchestrator re-routes.

# maxIterations sizing
Set to expected tool-call chain + 1 buffer. Lookup-respond agents: 3-5. Multi-step flows (lookup, diagnose, ticket, transfer): 5-6. Orchestrators: sub-agent count + 2-3.

# Condition-action pairs
Write explicit if-then pairs in natural language instead of listing tool names or capabilities. The model matches customer intent to actions more reliably.
Bad: "You have access to a customer lookup tool"
Good: "If the customer provides their identifier, look up their account"

# Iteration budget rule
Add to every sub-agent prompt: "Once you receive a successful response from any action, use that data immediately. Calling the same action twice with the same parameters wastes your limited iterations." For validation errors, ask the customer to verify instead of retrying.

# Sandwich technique
Repeat the single most critical behavioral rule at both START and END of the prompt. The primacy-recency effect is consistent across all transformer models and reinforces the rule the model is most likely to break.

# Anti-loop and graceful degradation
Sub-agents retry failed actions once max. If same error, escalate to human. For out-of-scope queries, respond with a clear handoff message and end the turn. Fallback hierarchy: use tool results > acknowledge failure > ask ONE clarifying question > end turn for re-routing > transfer to human. The agent must never fabricate data to fill gaps.

# General rules over specific scripts
System prompts must use general behavioral rules, never rigid step-by-step scripts with specific phrases or scenarios. Each customer interaction is different: the words, the order, the context all vary. A prompt that says "if the customer says X, respond with Y" breaks when the customer says something slightly different. Instead, describe the general principle and let the model adapt. The prompt defines boundaries and decision logic, not a conversation script.

# Tool-bounded behavior
Agents must only offer actions they can actually execute with their available tools. If an agent has no diagnostic tools, it must not diagnose. If it has no configuration tools, it must not suggest configuration changes. If it cannot verify a fact, it must not state it as true. The prompt must never describe capabilities the agent does not have. When writing or reviewing prompts, always cross-check the diagnostic/action flow against the actual MCP tools available to that specific agent.

## Writing tool descriptions for MCP tools and n8n

When writing or improving tool descriptions (MCP servers or tool nodes), apply these rules so the LLM can use them effectively:

- Write in English, plain text, no markup
- Each description must clearly state: what the tool does, what input it expects, what it returns
- Be specific and unambiguous. If two tools could overlap, make the distinction explicit in each description
- Do not repeat information that belongs in the system prompt (when/why to use). The description is about WHAT, the system prompt is about WHEN/WHY
- Keep descriptions concise but complete. The LLM reads these to decide which tool to call
- Bad: "Gets customer info"
- Good: "Searches customer by identifier or full name. Returns account data including current plan, address, status, and pending invoices. Input: id (string, optional), name (string, optional). At least one parameter required."
- Never mention implementation details in descriptions: no internal service names, no API methods, no mechanism names. The LLM only needs to know the action and its parameters
- Tool responses must be minimal: only data the LLM needs to formulate its answer. No internal IDs, no implementation details, no redundant confirmations repeating what was already obvious from the action

When writing or improving system prompts for n8n workflow agents (any .json workflow file), apply all the rules in this guide automatically without needing to be reminded.

## Differences between Grok 4 Fast and Grok 4.1 Fast

- Same prompting techniques for both
- grok-4.1-fast has ~3x fewer hallucinations (more likely to say "I don't know" instead of making things up)
- grok-4.1-fast has better tool-calling (specific training for agentic workflows)
- grok-4.1-fast is more emotionally intelligent and maintains better consistency in long conversations

## Claude Opus 4.6 (for Claude Code / myself)

- Source: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices
- Use XML tags for structure: <instructions>, <context>, <example>
- Do NOT use aggressive language: "CRITICAL: You MUST" causes overtriggering
- Use normal prompting: "Use this tool when..." instead of "CRITICAL: ALWAYS use..."
- More responsive to system prompt than previous models
- Excellent at parallel tool execution
- Concise and natural style, less verbose than previous versions
- Adaptive thinking: does not need "think step by step"
- Can overtrigger tools if the prompt is too insistent
- Prefer general instructions over prescriptive steps

## Coding Rules

- Code must be minimal, clean, and production-ready. Only essential code, zero bloat
- Never hardcode values that should be configurable. Use environment variables via .env for anything that changes between environments
- No dead code: if a variable, function, or config field is not consumed by actual logic, delete it
- Comments: only where the logic is not self-evident and Claude Code needs them to understand the code when re-reading. No version tags, no section headers, no obvious descriptions. requirements.txt, docker-compose.yml, Dockerfile: zero comments
- No unnecessary defaults in config: if a value is obtained from an API, do not duplicate it as a config variable
- No fallback values for API data: if data comes from an API, do not provide hardcoded fallback values. If the API fails, return a clear error message instead of silently using wrong defaults. Fallbacks mask failures and cause incorrect behavior
- Config fields must exist only if the code actually reads them. Audit before adding
- When multiple projects share the same architecture (e.g. MCP servers), they must be structured identically: same file names, same patterns, same .env structure
- Projects must always be organized in clear code modules and folder structure. Split large files into logical modules (e.g. utils.py, tools.py, services/). Each file has one responsibility. No monolithic files over ~200 lines if they can be split cleanly
- Before modifying a project, read ALL files first to understand what is actually used vs dead code
- No emojis in code, comments, or responses
- Console-only logging with readable format. No external log services
- Thorough error handling for edge cases. Trust nothing at system boundaries
- Follow enterprise security standards: OWASP Top 10, input validation, secrets never in code, principle of least privilege. For Chilean ISPs: RUT validation with MOD 11, Chilean data protection law compliance
- Prefer universal/generic patterns over project-specific ones to cover more cases with less code
- Never pad, prettify, or add decorative formatting to code output
- Always use `uv` instead of `pip` for Python package management (Dockerfile: `uv pip install`, local: `uv run`, `uv sync`)
- Always use `pnpm` instead of `npm` for Node.js/frontend package management (`pnpm install`, `pnpm run build`, `pnpm add`, `pnpm dlx`)
- All code, variable names, comments, and tool responses in English. Customer-facing messages sent to end users stay in the user's language
- MCP tools: descriptions, argument docs, and all tool return values must be in English. Only customer-facing messages sent directly to end users stay in the local language. Error messages returned by tools must also be in English

## MCP Best Practices for n8n

- All MCP tool functions must return `str`, never `dict` or other types. FastMCP serializes dicts to stringified JSON inside the MCP text response (`{"type":"text","text":"{\"key\":\"value\"}"}`), which n8n's AI Agent (LangChain) passes to the LLM as double-encoded JSON. Most models (especially Grok) cannot parse this reliably and enter infinite tool-call loops, re-calling the same tool because they cannot interpret the response
- Return plain text formatted for LLM readability. For simple results: `"Ticket created (ID: 123)"`. For complex data with nested structures, use key-value lines and `|`-separated list items
- Errors must be plain strings starting with `"Error: "`. No error wrapper dicts, no `success` field, no `transfer_required` field. The LLM infers success/failure from the content
- No metadata fields in responses: no `success`, `action_required`, `next_steps`, `transfer_required`. Every token in the response must be data the LLM needs to formulate its answer. Metadata is wasted tokens and noise that confuses the model
- Keep responses minimal. Only return data the LLM needs to respond to the customer. Internal IDs, API details, and implementation specifics are noise unless the agent needs them for a follow-up action
- Maximum 2-4 tools per agent node in n8n. More tools increase wrong tool selection and loops
- n8n's MCP Client node has a known serialization bug that stringifies JSON arrays/objects. If the MCP server expects native JSON types, handle deserialization server-side

## Docker / Dokploy

- Compose file must be named `docker-compose.yml`
- All services deployed via Dokploy with Traefik reverse proxy
- No redundant settings: if HOST is always 0.0.0.0, do not make it configurable. If PORT is in .env, do not duplicate it in `environment:`
- No custom networks unless required. Dokploy manages networking
- Healthcheck interval should be 120s (2 minutes) to avoid console spam. Use `curl -sf` (silent + fail) to suppress output. Restart policy and logging config are essential
- Python images: install uv first, then use `uv pip install` instead of `pip install`
