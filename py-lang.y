+ws

@ ::= statement*

name ::- @word
label ::- name

statement ::= def | if | for | return | let | assert | break | continue | yield | struct | async-stmt
block ::= '{' statement* '}'

named ::= name '=' expr
args-list ::- ( named | expr ... ',' )*
expr-list ::- ( expr ... ',' )+
unpack ::- '(' ( name ... ',' )+ ')'

tag ::= name [ '(' %expr-list ')' ]

def ::= 'def' name '(' args ')' tag* [ '->' typename ] block
if ::= 'if' ( expr block ):cond ( 'elif' expr block ):cond* [ 'else' block ]:else
for ::= 'for' [ '[' label ']' ] ( name ... ',' )+ 'in' expr block
return ::= 'return' [ %expr-list ] ';'
let ::= 'let' ( ( name | unpack ) '=' expr ... ',' ):bind* ';'
assert ::= 'assert' %expr-list ';'
break ::= 'break' [ label ] ';'
continue ::= 'continue' [ label ] ';'
yield ::= 'yield' [ %expr-list ] ';'

async-for ::= 'for' [ '[' label ']' ] ( name ... ',' )+ 'in' expr block
async-stmt ::- 'async' ( async-for )

struct ::= 'struct' name '{' field* '}'
field ::= typename name ';'
typename ::= name ( attribute | call | index ):sub*

expr ::= term ( mul | div | mod )*

mul ::= '*' term
div ::= '/' term
mod ::= '%' term

term ::= factor ( add | sub )*

add ::= '+' factor
sub ::= '-' factor

factor ::= ( neg | bitnot )* simple

neg ::= '-'
bitnot ::= '~'

simple ::= primary ( attribute | call | index )*

attribute ::= '.' name
call ::= '(' args-list ')'
index ::= '[' args-list ']'

primary ::= name | @number | @dquote | @squote | true | false | null | '(' expr ')'

true ::= 'true'
false ::= 'false'
null ::= 'null'
