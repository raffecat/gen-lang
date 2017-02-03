+ws +eol
syntax   ::= br ( '+' name br )* rule+
rule     ::= ( name | '@':name ) ( '::=' | '::-':inline ) alts eol !
alts     ::- ( sequence ... '|' )+
sequence ::= clause+
clause   ::= atom [ ':' name ] [ '?':opt | '+':plus | '*':star ] !
atom     ::- ref | term | group | maybe
ref      ::= [ '%':inline ] name
term     ::= text | '@' name
group    ::= '(' alts [ '...' delim ] ')'
maybe    ::= '[' alts [ '...' delim ] ']'
delim    ::- text
text     ::- @squote | @dquote
name     ::- @word
br       ::- @EOL*
eol      ::- @EOF | @EOL+
