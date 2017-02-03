#!/usr/bin/env node
'use strict';

const fs = require('fs'), basename = require('path').basename;
const assert = require('assert');
const log = console.log;
const inspect = require('util').inspect;

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// ––~,–`~–{@   Grammar Parser   @}–~,–`~––

var squote = "'([^\\\\']*(?:\\\\.[^\\\\']*)*)('?)",
    dquote = '"([^\\\\"]*(?:\\\\.[^\\\\"]*)*)("?)',
    word = "([@\\w][\\w\\d_-]*)",
    symbols = "(\\.\\.\\.|::=|::-|.)",
    tokenize = new RegExp("(\\r\\n?|\\n)|(\\s+|//[^\\r\\n]*)|"+squote+"|"+dquote+"|"+word+"|"+symbols, "g");

const unquote_map = { "b":"\b", "f":"\f", "n":"\n", "r":"\r", "t":"\t", "v":"\v", "0":"\0", "'":"'", "\"":"\"", "\\":"\\" };
function unquote(str) {
  return str.replace(/\\(.)/g, (ch) => unquote_map[ch] || ch); // (x[0-9A-Fa-f][0-9A-Fa-f]|.)
}

function parse(filepath) {
  var src = fs.readFileSync(filepath, 'utf8');
  var ofs = 0, line = 1;
  var re = tokenize; re.lastIndex = 0;
  var token, value, capture, previous;

  function trim(s) {
    return s.replace(/^\s+/,'').replace(/\s+$/,'');
  }

  function error(msg) {
    var report = basename(filepath)+":"+line+": "+msg;
    if (previous) report += " after '"+trim(previous)+"'";
    if (capture) report += ", found '"+trim(capture)+"'";
    die(report);
  }

  function advance() {
    previous = capture;
    for (;;) {
      var m = re.exec(src);
      if (!m) { token = "EOF"; break; }
      if (m[1]) { line += 1; token = "EOL"; capture = "beginning of line"; break; }
      if (m[2]) { continue; } // whitespace or comment.
      capture = m[0]; // token source text for error reporting.
      if (m[3] || m[5]) { // text literals.
        if ((m[3] && !m[4]) || (m[5] && !m[6])) {
          error("unterminated text literal");
        }
        value = unquote(m[3] || m[5]);
        token = "text";
        break;
      }
      if (m[7]) { value = m[7]; token = "word"; break; }
      token = m[8] || ""; break;
    }
  }

  function match(t) {
    if (token == t) { advance(); return true; }
    return false;
  }

  function shift() {
    var res = value; advance(); return res;
  }

  function expect(t, what) {
    if (token == t) { var res = value; advance(); return res; }
    error("expecting "+(what || "'"+t+"'"));
  }

  function word(what) {
    return expect("word", what);
  }

  // group ::= '(' alts [ '...' text:delim ] ')'
  // maybe ::= '[' alts [ '...' text:delim ] ']'

  function group(end, min) {
    var where = line;
    advance();
    var seq = alts();
    var delim = match("...") ? expect("text","a delimiter (text literal)") : null;
    expect(end, "'"+end+"' to end group");
    return { is:'group', alts:seq, name:null, min:min, max:1, line:where };
  }

  // ref ::= [ '%' ]:inline @word:name
  // literal ::= @text
  // atom ::- ref | literal | group | maybe

  function atom(required) {
    var where = line;
    if (token == 'word' || token == '%') {
      var inline = match("%");
      var repr = capture; // token source text.
      var name = word("a term-name (rule reference)");
      return { is:'ref', to:name, name:name, inline:inline, min:1, max:1, line:where };
    }
    if (token == 'text') {
      return { is:'literal', text:shift(), name:null, min:1, max:1, line:where };
    }
    if (token == '(') return group(')', 1);
    if (token == '[') return group(']', 0);
    if (required) error("expecting a term (rule-name, literal token or group expression)");
    return null; // no match: simulate first-token-set.
  }

  // term ::= atom [ ':' name ] [ '?' | '+' | '*' ]:arity

  function term(required) {
    var t = atom(required);
    if (!t) return null; // no match: simulate first-token-set.
    if (match(":")) {
      t.name = word("a name (term renaming)");
    }
    if (match("?")) { t.min = 0; t.max = 1; }
    else if (match("+")) { t.min = 1; t.max = Infinity; }
    else if (match("*")) { t.min = 0; t.max = Infinity; }
    return t;
  }

  // sequence ::= ( term [ ':' @word:name ] [ '?' | '+' | '*' ]:arity )+

  function sequence() {
    var seq = [ term(true) ];
    for (;;) {
      var t = term(false);
      if (!t) break; // no match: simulate first-token-set.
      seq.push(t);
    }
    return seq;
  }

  // alts ::= sequence ( '|' sequence )*

  function alts() {
    var seq = [ sequence() ];
    while (match("|")) {
      seq.push(sequence());
    }
    return seq;
  }

  // rule ::= @EOL* word:name ( '::=' | '::-' ) alts ( @EOF | @EOL )

  function rule() {
    while (match("EOL")) {} // skip blank lines.
    var where = line;
    var name = word("a name at the beginning of a rule");
    var inline = !!match("::-");
    if (!inline) expect("::=", "::= or ::- after rule name");
    var seq = alts();
    if (token !== "EOF") expect("EOL", "end of line to end rule '"+name+"'");
    return { is:'rule', name:name, alts:seq, inline:inline, line:where };
  }

  function rules() {
    var seq = [ rule() ];
    while (token != "EOF") {
      seq.push(rule());
    }
    return seq;
  }

  // @ ::= @EOL* ( '+' ( 'ws' | 'eol' ):option @EOL* )* rule+

  function start() {
    while (match("EOL")) {} // skip blank lines.
    while (match("+")) {
      var option = word("an option name");
      log("Option: +"+option);
      while (match("EOL")) {} // skip blank lines.
    }
    return rules();
  }

  advance();
  return start();
}


// ––~,–`~–{@   Generator   @}–~,–`~––

function compile(filepath) {
  var ruleList = parse(filepath);
  ruleList.map(r => log(inspect(r,{depth:10})));

  function error(rule, msg) {
    die(basename(filepath)+":"+rule.line+": "+msg+" in rule '"+rule.name+"'");
  }

  // index the rules on their unique names.
  var rules = {};
  for (var r of ruleList) {
    if (rules[r.name]) error(r, "duplicate rule name");
    rules[r.name] = r;
  }

  function is_terminal(node) {
    // references to @words are terminals.
    return node.is === 'literal' || (node.is === 'ref' && node.to.charAt(0) === '@');
  }

  function name_for_terminal(node) {
    assert(is_terminal(node));
    return node.is === 'literal' ? node.text : node.to; // literal or ref to @name.
  }

  function resolve_ref(rule, ref) {
    var to = rules[ref];
    if (!to) error(rule, "non-terminal '"+ref+"' not found");
    return to;
  }

  function add_terms(rule, first, seen, set) {
    // add a set of new first-terminals to the first-set being created (for a rule).
    // NB. all first-terminals in the resulting set must be unique, otherwise the generated
    // parser would need to be able to back-track after partially matching a rule.
    for (var term of set) {
      assert(term.in_rule); // has come from first_for_seq.
      var nom = name_for_terminal(term);
      if (seen[nom]) {
        var dup = seen[nom];
        assert(dup.in_rule); // has come from first_for_seq.
        error(rule, "ambiguous grammar: the same token '"+nom+"' appears on multiple branches:\n"+
          "  in rule '"+dup.in_rule+"' and in rule '"+term.in_rule+"'");
      }
      seen[nom] = term;
      first.push(term);
    }
  }

  function first_for_seq(rule, seq) {
    // attach the enclosing rule's name to every node in the sequence.
    for (var item of seq) { item.in_rule = rule.name; }
    // determine the set of first-terminals for a sequence.
    assert(seq.length > 0); // sequences cannot be empty (could allow it)
    var first = [];
    var seen = {};
    var epsilon = true; // until proven otherwise.
    for (var term of seq) {
      if (is_terminal(term)) {
        // if the next item is a terminal, it ends our first-set UNLESS it is optional.
        var set = [ term ];
        add_terms(rule, first, seen, set);
        if (term.min > 0) {
          epsilon = false; // terminal is required; is a non-epsilon sequence.
          break;
        } 
      } else if (term.is == 'ref') {
        // if the next item is a non-terminal, its first-set is part of our first-set,
        // and this ends our first-set UNLESS the rule-match is optional
        // or any of the alternatives in the rule are entirely optional.
        var to = resolve_ref(rule, term.to);
        var set = first_for_rule(to);
        add_terms(rule, first, seen, set);
        assert(set.has_epsilon != null); // must be set in first_for_rule.
        if (term.max > 1 && set.has_epsilon) {
          error(rule, "repeating non-terminal can match nothing (i.e. generates left-recursion ??)");
        }
        if (term.min > 0 && !set.has_epsilon) {
          epsilon = false; // must match, and all alts have a required terminal.
          break;
        }
      } else if (term.is == 'group') {
        // if the next item is a group, its first-set part of our first-set,
        // and this ends our first-set UNLESS the group is optional
        // or any of the alternatives in the group are entirely optional.
        var set = first_for_alts(rule, term.alts);
        add_terms(rule, first, seen, set);
        assert(set.has_epsilon != null); // must be set in first_for_alts.
        if (term.max > 1 && set.has_epsilon) {
          error(rule, "repeating group can match nothing (i.e. generates left-recursion ??)");
        }
        if (term.min > 0 && !set.has_epsilon) {
          epsilon = false; // must match, and all alts have a required terminal.
          break;
        }
      } else {
        error(rule, "bad term in sequence");
      }
    }
    first.has_epsilon = epsilon;
    return first;
  }

  function first_for_alts(rule, alts) {
    // merge the first-sets of each alternative sequence.
    // NB. the sets MUST be disjoint, otherwise we can't decide which alternative to parse.
    assert(alts.length > 0); // cannot have zero alternatives.
    var first = [];
    var seen = {};
    var epsilon = false; // until we find an epsilon alt.
    for (var seq of alts) {
      var set = first_for_seq(rule, seq);
      add_terms(rule, first, seen, set);
      if (set.has_epsilon) epsilon = true; // this alt can match nothing.
    }
    first.has_epsilon = epsilon;
    return first;
  }

  function first_for_rule(rule) {
    // merge the disjoint first-sets of each alternative sequence.
    assert(rule.is === 'rule');
    // only need to resolve the first-set once per rule.
    if (rule.firstSet) return rule.firstSet;
    // detect left-recursive reference cycles.
    if (rule.resolving) error(rule, "left-recursive cycle found");
    rule.resolving = true;
    // a rule behaves like a group: the first-set is the union of the
    // first-sets of the alternatives in the rule.
    rule.firstSet = first_for_alts(rule, rule.alts);
    // finished resolving this rule.
    rule.resolving = false;
    return rule.firstSet;
  }

  // find the starting rule.
  var start = rules["@"] || ruleList[0];
  if (!start) die(basename(filepath)+": no starting rule was found");

  // build the first-sets for each rule.
  first_for_rule(start);
  for (var rule of ruleList) {
    first_for_rule(rule);
  }

  // display the first-sets for all rules.
  log("---------");
  for (var rule of ruleList) {
    log(rule.name+":", rule.firstSet.map(name_for_terminal));
  }

  // next things to do:

  // actually, for recursive descent we need to get back the disjoint sets of
  // starting terminals for each non-terminal (what we have now)
  // so we can decide whether to descend into that non-terminal or not,
  // but only when we need to make that decision (often we always descend)

  // insert wrapper objects into the first-set that represent the terminal found,
  // with a chain of rule-activations traversed to get there; use the chain
  // to report the full paths from the point an ambiguity is discovered.

  // work out how to build an AST for infix expression operators.
  // is left-recursion fine? (ignore cyclical states except at the leaves)

  // how to generate sum-states for common terminal prefixes:
  // args-list ::- ( name '=' expr | expr ... ',' )*
  // expr ::= ... -> primary -> name

  // what are the second-sets? is it the set of exit terminals from the states
  // created by the first-sets? actually I think rules don't have first-sets
  // at all, but rather we must generate states starting from the '@' rule,
  // because the same rule can be visited in different current-states (BUT
  // isn't the entry state of a rule always the same? (the same set of exits
  // for the set of first-terminals?)
}


// ––~,–`~–{@   Main   @}–~,–`~––

if (!process.argv[2]) {
  console.error("usage: gen-lang <filename>");
  process.exit(1);
}

process.argv.slice(2).map(compile);
