+ws
@        ::= value*
value    ::= object | array | @string | @number | 'true' | 'false' | 'null'
object   ::= '{' pair ( ',' pair )* '}'
pair     ::= @string:key ':' value
array    ::= '[' value ( ',' value )* ']'
