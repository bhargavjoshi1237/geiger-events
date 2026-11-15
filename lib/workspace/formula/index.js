import { FUNCTIONS, toText, truthy } from "./functions.js";

export { formulaRefs, parseFormula, renameRefs, tokenize } from "./parse.js";
export const FORMULA_FUNCTIONS = Object.freeze(Object.keys(FUNCTIONS));

const blank = (value) => value === null || value === undefined || value === "";

function compare(op, left, right) {
  if (blank(left) || blank(right)) {
    if (op === "=") return blank(left) && blank(right);
    if (op === "!=") return blank(left) !== blank(right);
    return null;
  }
  const bothNumbers = typeof left === "number" && typeof right === "number";
  const a = bothNumbers ? left : toText(left).toLowerCase();
  const b = bothNumbers ? right : toText(right).toLowerCase();
  switch (op) {
    case "=": return a === b;
    case "!=": return a !== b;
    case "<": return a < b;
    case "<=": return a <= b;
    case ">": return a > b;
    default: return a >= b;
  }
}

function arithmetic(op, left, right) {
  if (typeof left !== "number" || typeof right !== "number") return null;
  if ((op === "/" || op === "%") && right === 0) return null;
  const result = op === "+" ? left + right : op === "-" ? left - right : op === "*" ? left * right : op === "/" ? left / right : left % right;
  return Number.isFinite(result) ? result : null;
}

// Evaluates a parsed formula against { fieldKey: value }; never throws.
export function evaluateFormula(ast, values, { now = new Date(), timeZone = "UTC" } = {}) {
  const ctx = { now, timeZone };
  const walk = (node) => {
    switch (node.t) {
      case "num": case "str": case "bool": return node.v;
      case "ref": { const value = values[node.name]; return value === undefined ? null : value; }
      case "un": {
        const value = walk(node.e);
        if (node.op === "NOT") return !truthy(value);
        return typeof value === "number" ? -value : null;
      }
      case "bin": {
        if (node.op === "AND") return truthy(walk(node.l)) && truthy(walk(node.r));
        if (node.op === "OR") return truthy(walk(node.l)) || truthy(walk(node.r));
        const left = walk(node.l);
        const right = walk(node.r);
        if (node.op === "&") return toText(left) + toText(right);
        if (["=", "!=", "<", "<=", ">", ">="].includes(node.op)) return compare(node.op, left, right);
        return arithmetic(node.op, left, right);
      }
      case "call": {
        if (node.fn === "IF") return truthy(walk(node.args[0])) ? walk(node.args[1]) : node.args[2] ? walk(node.args[2]) : null;
        return FUNCTIONS[node.fn].run(node.args.map(walk), ctx);
      }
      default: return null;
    }
  };
  try {
    const result = walk(ast);
    return result === undefined || (typeof result === "number" && !Number.isFinite(result)) ? null : result;
  } catch {
    return null;
  }
}
