import { LIMITS } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { FUNCTIONS } from "./functions.js";

const fail = (message, position) => {
  throw new WorkspaceError("invalid_formula", 422, position === undefined ? message : `${message} (at character ${position + 1}).`);
};

// Splits a formula into tokens; field references are written {Field name}.
export function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const match = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(source.slice(i));
      if (!match) fail("A number isn't written correctly", i);
      tokens.push({ t: "num", v: Number(match[0]), at: i });
      i += match[0].length;
      continue;
    }
    if (ch === "\"") {
      let j = i + 1;
      let text = "";
      while (j < source.length && source[j] !== "\"") {
        if (source[j] === "\\" && j + 1 < source.length) { text += source[j + 1]; j += 2; continue; }
        text += source[j++];
      }
      if (j >= source.length) fail("Text is missing its closing quote", i);
      tokens.push({ t: "str", v: text, at: i });
      i = j + 1;
      continue;
    }
    if (ch === "{") {
      const end = source.indexOf("}", i);
      if (end === -1) fail("A field reference is missing its closing }", i);
      const name = source.slice(i + 1, end).trim();
      if (!name) fail("A field reference is empty", i);
      tokens.push({ t: "ref", v: name, at: i, end: end + 1 });
      i = end + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i));
      tokens.push({ t: "id", v: match[0].toUpperCase(), at: i });
      i += match[0].length;
      continue;
    }
    const two = source.slice(i, i + 2);
    if (["<=", ">=", "!=", "<>"].includes(two)) { tokens.push({ t: "op", v: two === "<>" ? "!=" : two, at: i }); i += 2; continue; }
    if ("+-*/%&=<>(),".includes(ch)) { tokens.push({ t: ch === "(" || ch === ")" || ch === "," ? ch : "op", v: ch, at: i }); i++; continue; }
    fail(`"${ch}" can't be used here`, i);
  }
  return tokens;
}

export function parseFormula(source) {
  if (typeof source !== "string" || !source.trim()) fail("Write a formula.");
  if (source.length > LIMITS.formulaChars) fail(`Keep formulas under ${LIMITS.formulaChars} characters.`);
  const tokens = tokenize(source);
  let pos = 0;
  let depth = 0;
  const peek = () => tokens[pos];
  const isOp = (...ops) => peek()?.t === "op" && ops.includes(peek().v);
  const isWord = (word) => peek()?.t === "id" && peek().v === word;
  const enter = () => { if (++depth > LIMITS.formulaDepth) fail("This formula is nested too deeply."); };
  const expect = (type, label) => {
    const token = peek();
    if (!token) fail(`The formula ends early; expected ${label}`);
    if (token.t !== type) fail(`Expected ${label}`, token.at);
    pos++;
    return token;
  };

  function binary(next, test, wrap = (op) => op) {
    return () => {
      let left = next();
      while (test()) {
        const op = wrap(tokens[pos++].v);
        left = { t: "bin", op, l: left, r: next() };
      }
      return left;
    };
  }

  const primary = () => {
    const token = peek();
    if (!token) fail("The formula ends early; expected a value");
    if (token.t === "num" || token.t === "str") { pos++; return { t: token.t, v: token.v }; }
    if (token.t === "ref") { pos++; return { t: "ref", name: token.v }; }
    if (token.t === "(") {
      pos++;
      enter();
      const inner = orExpr();
      depth--;
      expect(")", "a closing )");
      return inner;
    }
    if (token.t === "id") {
      pos++;
      if (peek()?.t !== "(") {
        if (token.v === "TRUE" || token.v === "FALSE") return { t: "bool", v: token.v === "TRUE" };
        fail(`"${token.v}" isn't a value — put field names in { }`, token.at);
      }
      const spec = FUNCTIONS[token.v];
      if (!spec) fail(`${token.v} isn't a formula function`, token.at);
      pos++;
      enter();
      const args = [];
      if (peek()?.t !== ")") {
        args.push(orExpr());
        while (peek()?.t === ",") { pos++; args.push(orExpr()); }
      }
      depth--;
      expect(")", "a closing )");
      if (args.length < spec.min || args.length > spec.max) {
        const count = spec.min === spec.max ? spec.min : spec.max === Infinity ? `at least ${spec.min}` : `${spec.min}–${spec.max}`;
        fail(`${token.v} takes ${count} value${spec.max === 1 ? "" : "s"}`, token.at);
      }
      return { t: "call", fn: token.v, args };
    }
    fail("Expected a value", token.at);
  };

  const unary = () => {
    if (isOp("-", "+")) {
      const op = tokens[pos++].v;
      enter();
      const operand = unary();
      depth--;
      return op === "-" ? { t: "un", op: "-", e: operand } : operand;
    }
    return primary();
  };
  const multiplicative = binary(unary, () => isOp("*", "/", "%"));
  const additive = binary(multiplicative, () => isOp("+", "-"));
  const concat = binary(additive, () => isOp("&"));
  const comparison = binary(concat, () => isOp("=", "!=", "<", "<=", ">", ">="));
  const notExpr = () => {
    if (isWord("NOT")) {
      pos++;
      enter();
      const operand = notExpr();
      depth--;
      return { t: "un", op: "NOT", e: operand };
    }
    return comparison();
  };
  const andExpr = binary(notExpr, () => isWord("AND"));
  function orExpr() { return binary(andExpr, () => isWord("OR"))(); }

  const ast = orExpr();
  if (pos < tokens.length) fail("Something unexpected follows the formula", tokens[pos].at);
  return ast;
}

export function formulaRefs(ast, refs = new Set()) {
  if (!ast) return refs;
  if (ast.t === "ref") refs.add(ast.name);
  if (ast.t === "bin") { formulaRefs(ast.l, refs); formulaRefs(ast.r, refs); }
  if (ast.t === "un") formulaRefs(ast.e, refs);
  if (ast.t === "call") ast.args.forEach((arg) => formulaRefs(arg, refs));
  return refs;
}

// Rewrites {references} outside of text, e.g. field names to keys when saving and back when editing.
export function renameRefs(source, rename) {
  const tokens = tokenize(source);
  let out = "";
  let last = 0;
  for (const token of tokens) {
    if (token.t !== "ref") continue;
    out += source.slice(last, token.at) + `{${rename(token.v)}}`;
    last = token.end;
  }
  return out + source.slice(last);
}
