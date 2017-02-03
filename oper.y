+ws
@       ::= expr
expr    ::= factor ^ ( ( '+' | '-' ) factor )*
factor  ::= term ^ ( ( '*' | '/' ) term )*
term    ::= @number | '(' expr ')'
