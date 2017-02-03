# How Parse-Gen Works

The following is a machine-readable EEBNF sufficient to parse and build an AST.

Each "::=" rule becomes an AST node with a node structure named for the rule.  
Rules declared with "::-" are semantically inlined instead (substituted at the use sites).

Each non-terminal (rule reference) in a rule becomes a field of that node's structure.  
An inlined rule ("::-") instead inserts the fields of the inlined rule at the use site.  
The field name is the non-terminal name, unless renamed with a ":name" suffix.    
A terminal (quoted text) can also be named with a ":name" suffix, and will generate a field.  
Field names within a node must be unique; duplicate names generate an error.  
A repeated field (subject to "*" or "+") generates an array field.  
A repeated group of (more than one) fields generates an array of structures; the group must be named.   
A non-repeated, named group of (more than one) fields also generates a structure.   

The "..." operator in a group matches the terminal that follows before each repetition, i.e. a delimiter.  
The "|" (alternatives) operator binds more tightly than the "..." operator.  
The "%" operator forces the following non-terminal to be inlined, even if declared with "::=".  
The first rule declared is the starting rule for the grammar.

```
  syntax   ::= eol ( '+' name eol )* rule+
  rule     ::= ( name | '@':name ) ( '::=' | '::-':inline.b ) alts eol !
  alts     ::- ( sequence ... '|' )+
  sequence ::- clause+
  clause   ::= atom [ ':' name ] [ '?':opt | '+':plus | '*':star ] !
  atom     ::- ref | term | group | maybe
  ref      ::= [ '%':inline.b ] name
  term     ::= text | '@' name
  group    ::= '(' alts [ '...' delim ] ')'
  maybe    ::= '[' alts [ '...' delim ] ']'
  delim    ::- text
  text     ::- @squote | @dquote
  name     ::- @word
  eol      ::- @EOF | @EOL*
```

Literals (quoted-text) and terminals beginning with "@" are treated as tokens for
the purposes of parsing: they are the lexical tokens of the grammar.

Error reporting: the "!" marker on the end of some rules indicates an expected entity
for error reporting: if the parser cannot match the input after attempting to match
a marked rule, and the input has not yet advanced, it will report that it was expecting
the marked entity rather than some set of possible tokens.

NB. not sure about "inlined rules" described above. If an inlined rule contains a single field
in each alternative, I actually want to unwrap that field and rename it at the use-site,
as in the "alts" rule above.

NB. note how the 'rule' rule contains two alternatives with the same name. This should be legal,
even though duplicate field names are illegal. In fact this pattern might be common.

NB. if a group is named, and contains alternatives with only text-tokens, what gets named?

NB. consider this rule, which contains a repeat inside a repeat. Does this generate an array of arrays?

  alts     ::- ( clause+ ... '|' )+

NB. the implementation of the rule below doesn't follow the rule itself:
Instead, it greedily consumes EOL before deciding whether to match the group.

  @ ::= ( @EOL* '+' ( 'ws' | 'eol' ) )* rule+


First, it builds an AST for the rules in the grammar.
The nodes in the AST are:

```
  rule {
    name: of this rule.
    alts: alternative sequences (list of lists of group/term/ref)
    inline: bool, true for inlined rules, i.e. "::-"
    line: source line number.
  }
  group {
    alts: alternative sequences (list of lists of group/term/ref)
    as: null, or the name given with the ":name" syntax.
    min: zero for "[]", or "?" or "*" suffix, one otherwise.
    max: Infinity for "*" or "+" suffix, one otherwise.
    line: source line number.
  }
  term {
    text: null, or the literal quoted text in the grammar.
    name: null, or the name after '@' in the grammar.
    repr: original source representation of the term.
    as: null, or the name given with the ":name" syntax.
    min: zero for "?" or "*" suffix, one otherwise.
    max: Infinity for "*" or "+" suffix, one otherwise.
    line: source line number.
  }
  ref {
    to: name of the rule referred to.
    as: null, or the name given with the ":name" syntax.
    inline: bool, true for an inlined reference, i.e. "%name"
    min: zero for "?" or "*" suffix, one otherwise.
    max: Infinity for "*" or "+" suffix, one otherwise.
    line: source line number.
  }
```

### Decidability

Generally prefer constructs that are obvious and can be proven correct by construction,
even at some loss of expressivity.

So, apply restrictions to the acceptable grammars until we can prove the parser will
make progress (or terminate at some recursion limit) and does not contain any unreachable
states.

Things we know:

* A rule defines a named _pattern_ that generates an AST node when it matches.
* If a rule matches "nothing", it cannot generate a node, so is that illegal?
* An inlined rule doesn't generate a node, so it can match "nothing".

Naming rules:

A "renamed" term is any term (group, rule-ref or literal) with a ":name" suffix.
The implicit name for a term is the rule name for a rule-ref or @ref.
Groups and literals do not have an implicit name.

Structures:
A rule body always generates a structure, unless it is inlined into another rule's structure.
A repeating term that contains two or more fields always generates an array-of-structures field.
An optional term that contains two or more fields - ?

Fields:
A rule-ref always generates a 'node-ref' field, (unless the rule is inlined,
in which case the inlined rule's structure is merged at the use-site.)
A named literal always generates a 'string' (or 'boolean' with .b) field.
A lexical literal (@word, @number, @string) always generates a field.

Merging:
Duplicate field names within the same structure are merged (they refer to the
same field) but they must be in different alternatives to be legal.

When two or more fields are repeated together, i.e. they appear inside a repeating group,
they generate an array of structures, and the group must be explicitly named.
This rule applies whether the fields are generated in different alternatives or not;
the alternative that matches will populate its fields, and any remaining fields will
be given their default value.
The name need not appear on the group that actually causes the repetition, but
some enclosing group must supply a name for the field-group.

When a single field is repeated, it becomes an array and must have a name.

Implicit naming: if a named inline rule contains a single term without an explicit name,
that term is renamed with the name of the inline rule.


### CFGs

https://en.wikipedia.org/wiki/LL_parser
https://en.wikipedia.org/wiki/Chomsky_normal_form
^ have actually implemented most of the steps in DEL.

Look at masq.lua

a+  === A -> Aa | a
a?  === A -> a | e
(a) === A -> a


### Operator Precedence

```
  expr    ::= factor ( ( '+' | '-' ) factor )*
  factor  ::= term ( ( '*' | '/' ) term )*
  term    ::= @number | '(' expr ')'
```


### PEGs

Parsing expression grammars: http://www.inf.puc-rio.br/~roberto/docs/peg.pdf
A kind of Generalized Top-Down Parsing Language.


### Left Recursion

Left-recursive non-terminals cause a cycle in depth-first traversal from the "@" rule.

Can eliminate by moving the left-recursive patterns to the end of the recursively invoked rule
as a set of repeating (star) alternatives, and with the left-most term in each pattern elided,
i.e. the term that caused the left-recursion.

In other words, to match a left-recursive rule, we must be able to match the rule after deleting
the left-recursive patterns; after matching it, we can repeatedly match those deleted patterns.
For AST generation, each repeated match must "lift" the current AST node (on its left) and make
it a field of the new AST node, and replace the lifted node with the new node.

However, there are two complications:

1. Other parts of the grammar might be using those same rules, with or without their own
   recursive cycles, so we cannot just modify the rules in-place; we must copy them.
   This can result in unused rules, so at the end of the process we must prune those.

2. In the general case, left-recursion occurs as a tree of rules and groups with arbitrary depth,
   and within that tree are left-recursive leaves and non-left-recursive leaves. It is also
   possible that there are other left-recursive cycles within the left-recursive cycle, or an
   arbitrary number of co-recursive cycles.

